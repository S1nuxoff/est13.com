from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from aiogram.types import FSInputFile

from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.enums import LeadStatus
from est13_core.db.models.lead import Lead
from est13_core.db.models.user import User
from est13_core.db.repositories.chat import ChatRepository

from ..deps import get_db, require_admin, require_admin_token
from ..schemas.broadcast import (
    BroadcastEstimateOut,
    BroadcastIn,
    BroadcastOut,
    BroadcastPhotoOut,
)
from ..services.bot import build_bot
from ..services.media import media_root, save_upload_image


def _parse_lead_statuses(values: list[str] | None) -> list[LeadStatus] | None:
    if not values:
        return None
    out: list[LeadStatus] = []
    for v in values:
        try:
            out.append(LeadStatus(str(v)))
        except Exception:
            continue
    return out or None


def _norm_lang_codes(values: list[str] | None) -> list[str] | None:
    if not values:
        return None
    out = [str(x).strip() for x in values if str(x).strip()]
    return out or None


def _norm_ints(values: list[int] | None) -> list[int] | None:
    if not values:
        return None
    out: list[int] = []
    for x in values:
        try:
            out.append(int(x))
        except Exception:
            continue
    return out or None


def _build_broadcast_users_stmt(payload: BroadcastIn):
    stmt = select(User)

    tg_ids = _norm_ints(payload.tg_ids)
    if tg_ids:
        stmt = stmt.where(User.tg_id.in_(tg_ids))

    if payload.support_enabled is not None:
        stmt = stmt.where(User.support_enabled.is_(bool(payload.support_enabled)))
    elif payload.only_support_enabled:
        stmt = stmt.where(User.support_enabled.is_(True))

    langs = _norm_lang_codes(payload.language_codes)
    if langs:
        stmt = stmt.where(User.language_code.in_(langs))

    if payload.last_active_days is not None:
        days = int(payload.last_active_days)
        if days > 0:
            since = datetime.utcnow() - timedelta(days=min(days, 3650))
            stmt = stmt.where(User.updated_at >= since)

    need_lead = any(
        x is not None
        for x in (
            payload.has_active_lead,
            payload.last_lead_statuses,
            payload.service_ids,
        )
    )
    if need_lead:
        lead_rn = (
            func.row_number()
            .over(partition_by=Lead.user_id, order_by=Lead.id.desc())
            .label("rn")
        )
        lead_sub = select(
            Lead.user_id.label("user_id"),
            Lead.status.label("status"),
            Lead.service_id.label("service_id"),
            lead_rn,
        ).subquery()
        stmt = stmt.outerjoin(
            lead_sub, (lead_sub.c.user_id == User.id) & (lead_sub.c.rn == 1)
        )

        if payload.has_active_lead is True:
            stmt = stmt.where(lead_sub.c.status == LeadStatus.filling)
        elif payload.has_active_lead is False:
            stmt = stmt.where(
                (lead_sub.c.status.is_(None))
                | (lead_sub.c.status != LeadStatus.filling)
            )

        statuses = _parse_lead_statuses(payload.last_lead_statuses)
        if statuses:
            stmt = stmt.where(lead_sub.c.status.in_(statuses))

        service_ids = _norm_ints(payload.service_ids)
        if service_ids:
            stmt = stmt.where(lead_sub.c.service_id.in_(service_ids))

    return stmt.order_by(User.id)


def register(app: FastAPI) -> None:
    @app.post("/api/broadcast")
    async def broadcast(
        payload: BroadcastIn,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> BroadcastOut:
        text = (payload.text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Empty message")

        stmt = _build_broadcast_users_stmt(payload)
        res = await db.execute(stmt)
        users = list(res.scalars().all())

        sent = 0
        failed = 0
        abs_photo: Path | None = None
        rel_photo = (payload.photo_path or "").strip()
        if rel_photo:
            abs_photo = media_root() / rel_photo
            if not abs_photo.exists():
                abs_photo = None

        bot = build_bot()
        try:
            for u in users:
                chat_id = getattr(u, "last_chat_id", None) or u.tg_id
                try:
                    if abs_photo is not None:
                        if len(text) <= 1024:
                            tg_msg = await bot.send_photo(
                                chat_id=chat_id,
                                photo=FSInputFile(abs_photo),
                                caption=text,
                            )
                        else:
                            tg_msg = await bot.send_photo(
                                chat_id=chat_id, photo=FSInputFile(abs_photo)
                            )
                            await bot.send_message(chat_id=chat_id, text=text)
                    else:
                        tg_msg = await bot.send_message(chat_id=chat_id, text=text)
                    await ChatRepository(db).add_outbound(
                        user_id=u.id,
                        text=text,
                        tg_message_id=getattr(tg_msg, "message_id", None),
                        admin_id=int(admin.id) if admin is not None else None,
                    )
                    sent += 1
                except Exception:
                    failed += 1
                    continue
            await db.commit()
        finally:
            await bot.session.close()

        return BroadcastOut(ok=True, total=len(users), sent=sent, failed=failed)

    @app.post("/api/broadcast/estimate", dependencies=[Depends(require_admin_token)])
    async def broadcast_estimate(
        payload: BroadcastIn, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> BroadcastEstimateOut:
        stmt = _build_broadcast_users_stmt(payload).subquery()
        row = await db.execute(select(func.count()).select_from(stmt))
        return BroadcastEstimateOut(total=int(row.scalar_one() or 0))

    @app.post("/api/broadcast/photo", dependencies=[Depends(require_admin_token)])
    async def broadcast_upload_photo(
        db: Annotated[AsyncSession, Depends(get_db)],
        file: UploadFile = File(...),
    ) -> BroadcastPhotoOut:
        rel = await save_upload_image(file, folder="broadcast", prefix="broadcast")
        return BroadcastPhotoOut(photo_path=rel)
