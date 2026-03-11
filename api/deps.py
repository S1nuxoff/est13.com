from __future__ import annotations

import hashlib
import json
import secrets
import hmac
from datetime import datetime, timezone
from typing import Annotated, AsyncGenerator
from urllib.parse import parse_qsl

from fastapi import Cookie, Depends, Header, HTTPException, Response
from fastapi.requests import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.config import get_settings
from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.admin_session import AdminSession
from est13_core.db.models.user import User
from est13_core.db.repositories.user import UserRepository


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    sessionmaker = request.app.state.sessionmaker
    async with sessionmaker() as session:
        yield session


def _verify_webapp_init_data(
    init_data: str, *, bot_token: str, max_age_seconds: int = 86400
) -> dict:
    """
    Verify Telegram WebApp initData.
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    """
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    their_hash = pairs.get("hash", "")
    if not their_hash:
        raise HTTPException(status_code=401, detail="Invalid initData")

    data_check_list: list[str] = []
    for k in sorted(pairs.keys()):
        if k == "hash":
            continue
        data_check_list.append(f"{k}={pairs[k]}")
    data_check_string = "\n".join(data_check_list).encode("utf-8")

    secret_key = hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    calc_hash = hmac.new(secret_key, data_check_string, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, their_hash):
        raise HTTPException(status_code=401, detail="Invalid initData")

    try:
        auth_date = int(pairs.get("auth_date") or "0")
    except ValueError:
        auth_date = 0
    if auth_date <= 0:
        raise HTTPException(status_code=401, detail="Invalid initData")
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if max_age_seconds > 0 and now_ts - auth_date > max_age_seconds:
        raise HTTPException(status_code=401, detail="initData expired")

    user_raw = pairs.get("user") or ""
    user = json.loads(user_raw) if user_raw else None
    if not isinstance(user, dict):
        raise HTTPException(status_code=401, detail="Invalid initData user")
    return user


async def require_webapp_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
    x_tg_init_data: Annotated[str | None, Header(alias="X-Tg-Init-Data")] = None,
    wa_session: Annotated[str | None, Cookie(alias="wa_session")] = None,
) -> User:
    settings = get_settings()
    init_data = (x_tg_init_data or "").strip()
    if not init_data:
        if not bool(getattr(settings, "webapp_allow_anon", False)):
            raise HTTPException(
                status_code=401,
                detail="Відкрийте міні-апку через Telegram (initData відсутні).",
            )

        # Dev/debug mode only: anonymous web session (outside Telegram).
        token = (wa_session or "").strip()
        if not token:
            token = secrets.token_urlsafe(32)
            secure = settings.app_env == "prod"
            response.set_cookie(
                key="wa_session",
                value=token,
                httponly=True,
                secure=secure,
                samesite="lax",
                max_age=60 * 60 * 24 * 30,
                path="/",
            )

        digest = hashlib.sha256(token.encode("utf-8")).digest()
        tg_id = -int.from_bytes(digest[:8], "big", signed=False)

        obj = await UserRepository(db).upsert(
            tg_id=tg_id,
            username=f"web_{abs(tg_id)}",
            first_name=None,
            last_name=None,
            language_code="uk",
            last_chat_id=None,
        )
        await db.commit()
        return obj

    if not settings.bot_token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN is not set")
    tg_user = _verify_webapp_init_data(init_data, bot_token=settings.bot_token)

    try:
        tg_id = int(tg_user.get("id"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid user")

    obj = await UserRepository(db).upsert(
        tg_id=tg_id,
        username=tg_user.get("username"),
        first_name=tg_user.get("first_name"),
        last_name=tg_user.get("last_name"),
        language_code=tg_user.get("language_code"),
        last_chat_id=None,
    )
    await db.commit()
    return obj


async def _require_auth(db: AsyncSession, token: str | None) -> AdminAccount | None:
    settings = get_settings()
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Потрібен токен")

    if settings.admin_api_token and token == settings.admin_api_token:
        return None

    now = datetime.now(timezone.utc)
    q = (
        select(AdminSession, AdminAccount)
        .join(AdminAccount, AdminAccount.id == AdminSession.admin_id)
        .where(AdminSession.token == token)
        .where(AdminSession.expires_at > now)
        .where(AdminAccount.is_active.is_(True))
    )
    res = await db.execute(q)
    row = res.first()
    if row is None:
        raise HTTPException(status_code=401, detail="Сесія недійсна")
    sess, admin = row
    await db.execute(
        update(AdminSession).where(AdminSession.id == sess.id).values(last_seen_at=now)
    )
    return admin


async def require_admin_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
) -> None:
    await _require_auth(db, x_admin_token)


async def require_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
) -> AdminAccount | None:
    return await _require_auth(db, x_admin_token)


def is_super_admin(admin: AdminAccount | None) -> bool:
    return admin is None or bool(getattr(admin, "is_super", False))


async def get_super_admin_ids(db: AsyncSession) -> set[int]:
    res = await db.execute(
        select(AdminAccount.id).where(AdminAccount.is_super.is_(True))
    )
    return {int(row[0]) for row in res.all()}
