from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.config import get_settings
from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.admin_session import AdminSession

from ..deps import get_db, is_super_admin, require_admin, require_admin_token
from ..schemas.admins import (
    AdminAccountCreateIn,
    AdminAccountOut,
    AdminAccountPatchIn,
    AdminMeOut,
    LoginIn,
    LoginOut,
)
from ..services.auth import hash_password, verify_password


def register(app: FastAPI) -> None:
    @app.post("/api/auth/login")
    async def auth_login(
        payload: LoginIn, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> LoginOut:
        username = payload.username.strip().lower()
        password = payload.password
        if not username or not password:
            raise HTTPException(status_code=400, detail="Вкажіть логін і пароль")

        res = await db.execute(
            select(AdminAccount).where(AdminAccount.username == username)
        )
        admin = res.scalar_one_or_none()
        if (
            admin is None
            or not admin.is_active
            or not verify_password(password, admin.password_hash)
        ):
            raise HTTPException(status_code=401, detail="Невірний логін або пароль")

        token = secrets.token_urlsafe(48)[:96]
        now = datetime.now(timezone.utc)
        expires = now + timedelta(days=14)
        db.add(AdminSession(admin_id=admin.id, token=token, expires_at=expires))
        await db.execute(
            update(AdminAccount)
            .where(AdminAccount.id == admin.id)
            .values(last_login_at=now)
        )
        await db.commit()

        return LoginOut(
            token=token,
            admin=AdminMeOut(
                id=admin.id,
                username=admin.username,
                display_name=admin.display_name,
                avatar_emoji=getattr(admin, "avatar_emoji", None),
                is_super=bool(getattr(admin, "is_super", False)),
            ),
        )

    @app.get("/api/auth/me", dependencies=[Depends(require_admin_token)])
    async def auth_me(
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> AdminMeOut:
        if admin is None:
            return AdminMeOut(
                id=0,
                username="super",
                display_name="Super",
                avatar_emoji="⚡",
                is_super=True,
            )
        return AdminMeOut(
            id=admin.id,
            username=admin.username,
            display_name=admin.display_name,
            avatar_emoji=getattr(admin, "avatar_emoji", None),
            is_super=bool(getattr(admin, "is_super", False)),
        )

    @app.post("/api/auth/logout", dependencies=[Depends(require_admin_token)])
    async def auth_logout(
        db: Annotated[AsyncSession, Depends(get_db)],
        x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
    ) -> dict:
        settings = get_settings()
        token = (x_admin_token or "").strip()
        if settings.admin_api_token and token == settings.admin_api_token:
            return {"ok": True}
        await db.execute(delete(AdminSession).where(AdminSession.token == token))
        await db.commit()
        return {"ok": True}

    @app.get("/api/admins", dependencies=[Depends(require_admin_token)])
    async def list_admins(
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> list[AdminAccountOut]:
        is_super = is_super_admin(admin)
        stmt = select(AdminAccount)
        if not is_super:
            stmt = stmt.where(AdminAccount.is_super.is_(False))
        res = await db.execute(stmt.order_by(AdminAccount.id))
        items: list[AdminAccountOut] = []
        for a in res.scalars().all():
            items.append(
                AdminAccountOut(
                    id=a.id,
                    username=a.username,
                    display_name=a.display_name,
                    avatar_emoji=getattr(a, "avatar_emoji", None),
                    is_super=bool(getattr(a, "is_super", False)),
                    is_active=bool(a.is_active),
                    created_at=a.created_at.isoformat() if a.created_at else "",
                    last_login_at=(
                        a.last_login_at.isoformat() if a.last_login_at else None
                    ),
                )
            )
        return items

    @app.post("/api/admins", dependencies=[Depends(require_admin_token)])
    async def create_admin(
        payload: AdminAccountCreateIn,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> AdminAccountOut:
        username = payload.username.strip().lower()
        if not username or len(username) < 3:
            raise HTTPException(status_code=400, detail="Некоректний логін")
        if not payload.password or len(payload.password) < 6:
            raise HTTPException(
                status_code=400, detail="Пароль має бути не менше 6 символів"
            )

        is_super_request = is_super_admin(admin)
        is_super = bool(payload.is_super) if is_super_request else False
        if payload.is_super and not is_super_request:
            raise HTTPException(
                status_code=403, detail="Only super admin can set is_super"
            )

        a = AdminAccount(
            username=username,
            display_name=payload.display_name,
            avatar_emoji=payload.avatar_emoji,
            password_hash=hash_password(payload.password),
            is_active=True,
            is_super=is_super,
        )
        db.add(a)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=409, detail="Такий логін вже існує"
            ) from None
        await db.refresh(a)
        return AdminAccountOut(
            id=a.id,
            username=a.username,
            display_name=a.display_name,
            avatar_emoji=getattr(a, "avatar_emoji", None),
            is_super=bool(getattr(a, "is_super", False)),
            is_active=bool(a.is_active),
            created_at=a.created_at.isoformat() if a.created_at else "",
            last_login_at=a.last_login_at.isoformat() if a.last_login_at else None,
        )

    @app.patch("/api/admins/{admin_id}", dependencies=[Depends(require_admin_token)])
    async def patch_admin(
        admin_id: int,
        payload: AdminAccountPatchIn,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> AdminAccountOut:
        a = await db.get(AdminAccount, admin_id)
        if a is None:
            raise HTTPException(status_code=404, detail="Not found")

        is_super_request = is_super_admin(admin)
        if not is_super_request and bool(getattr(a, "is_super", False)):
            raise HTTPException(status_code=404, detail="Not found")

        if payload.display_name is not None:
            a.display_name = payload.display_name
        if payload.avatar_emoji is not None:
            a.avatar_emoji = payload.avatar_emoji
        if payload.is_active is not None:
            a.is_active = payload.is_active
        if payload.is_super is not None:
            if not is_super_request:
                raise HTTPException(
                    status_code=403, detail="Only super admin can change is_super"
                )
            a.is_super = bool(payload.is_super)
        if payload.new_password is not None:
            new_password = payload.new_password
            if len(new_password) < 6:
                raise HTTPException(
                    status_code=400, detail="Пароль має бути не менше 6 символів"
                )

            if not is_super_request:
                if admin is None or admin.id != a.id:
                    raise HTTPException(
                        status_code=403,
                        detail="Можна змінювати пароль тільки для свого акаунта",
                    )
                if not payload.old_password:
                    raise HTTPException(status_code=400, detail="Введіть старий пароль")
                if not verify_password(payload.old_password, a.password_hash):
                    raise HTTPException(
                        status_code=400, detail="Старий пароль невірний"
                    )

            a.password_hash = hash_password(new_password)
            await db.execute(delete(AdminSession).where(AdminSession.admin_id == a.id))

        await db.commit()
        return AdminAccountOut(
            id=a.id,
            username=a.username,
            display_name=a.display_name,
            avatar_emoji=getattr(a, "avatar_emoji", None),
            is_super=bool(getattr(a, "is_super", False)),
            is_active=bool(a.is_active),
            created_at=a.created_at.isoformat() if a.created_at else "",
            last_login_at=a.last_login_at.isoformat() if a.last_login_at else None,
        )

    @app.delete("/api/admins/{admin_id}", dependencies=[Depends(require_admin_token)])
    async def delete_admin(
        admin_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if not is_super_admin(admin):
            raise HTTPException(status_code=403, detail="Only super admin can delete admins")

        a = await db.get(AdminAccount, admin_id)
        if a is None:
            raise HTTPException(status_code=404, detail="Not found")

        if admin is not None and int(admin.id) == int(a.id):
            raise HTTPException(status_code=409, detail="Cannot delete own account")

        await db.delete(a)
        await db.commit()
        return {"ok": True}
