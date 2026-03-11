from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.chat_message import ChatMessage
from est13_core.db.models.enums import LeadStatus, MessageDirection
from est13_core.db.models.lead import Lead
from est13_core.db.models.question import Question
from est13_core.db.models.service import Service
from est13_core.db.models.user import User
from est13_core.db.repositories.chat import ChatRepository

from ..deps import get_db, get_super_admin_ids, is_super_admin, require_admin, require_admin_token
from ..schemas.common import AdminShortOut
from ..schemas.users import (
    ChatMessageOut,
    ChatMessagesOut,
    SendMessageIn,
    UserListOut,
    UserOut,
    UserPatch,
)
from ..services.bot import build_bot, fetch_telegram_file_bytes
from ..services.support import auto_disable_expired_support, support_expires_at


def _admin_short(a: AdminAccount) -> AdminShortOut:
    return AdminShortOut(
        id=int(a.id),
        username=str(a.username),
        display_name=getattr(a, "display_name", None),
        avatar_emoji=getattr(a, "avatar_emoji", None),
    )


def register(app: FastAPI) -> None:
    @app.get("/api/users", dependencies=[Depends(require_admin_token)])
    async def list_users(
        db: Annotated[AsyncSession, Depends(get_db)],
        limit: int = 50,
        q: str | None = None,
        admin: Annotated[AdminAccount | None, Depends(require_admin)] = None,
    ) -> UserListOut:
        limit = min(max(int(limit), 1), 200)
        try:
            await auto_disable_expired_support(db)
        except Exception:
            pass

        stmt = (
            select(User)
            .order_by(User.updated_at.desc().nullslast(), User.id.desc())
            .limit(limit)
        )
        if q:
            qv = q.strip()
            if qv.isdigit():
                stmt = (
                    select(User)
                    .where(User.tg_id == int(qv))
                    .order_by(User.updated_at.desc().nullslast(), User.id.desc())
                    .limit(limit)
                )
            else:
                like = f"%{qv}%"
                stmt = (
                    select(User)
                    .where(
                        (User.username.ilike(like))
                        | (User.first_name.ilike(like))
                        | (User.last_name.ilike(like))
                    )
                    .order_by(User.updated_at.desc().nullslast(), User.id.desc())
                    .limit(limit)
                )
        res = await db.execute(stmt)
        users = res.scalars().all()

        super_admin_ids: set[int] = set()
        if not is_super_admin(admin):
            super_admin_ids = await get_super_admin_ids(db)

        admin_by_id: dict[int, AdminAccount] = {}
        support_admin_ids = {
            int(getattr(u, "support_admin_id"))
            for u in users
            if getattr(u, "support_admin_id", None)
        }
        if support_admin_ids:
            ares = await db.execute(
                select(AdminAccount).where(AdminAccount.id.in_(support_admin_ids))
            )
            admin_by_id = {int(a.id): a for a in ares.scalars().all()}

        stage_by_user_id: dict[int, tuple[int, str, str | None]] = {}
        unread_by_user_id: dict[int, int] = {}
        if users:
            user_ids = [u.id for u in users]
            lead_rn = (
                func.row_number()
                .over(partition_by=Lead.user_id, order_by=Lead.id.desc())
                .label("rn")
            )
            lead_sub = (
                select(
                    Lead.user_id.label("user_id"),
                    Lead.id.label("lead_id"),
                    Lead.service_id.label("service_id"),
                    Lead.current_question_id.label("current_question_id"),
                    lead_rn,
                )
                .where(Lead.status == LeadStatus.filling)
                .where(Lead.user_id.in_(user_ids))
                .subquery()
            )
            lead_rows = await db.execute(
                select(
                    lead_sub.c.user_id,
                    lead_sub.c.lead_id,
                    Service.title,
                    Question.text,
                )
                .join(Service, Service.id == lead_sub.c.service_id)
                .outerjoin(Question, Question.id == lead_sub.c.current_question_id)
                .where(lead_sub.c.rn == 1)
            )
            for uid, lead_id, svc_title, q_text in lead_rows.all():
                stage_by_user_id[int(uid)] = (
                    int(lead_id),
                    str(svc_title),
                    str(q_text) if q_text is not None else None,
                )

            unread_rows = await db.execute(
                select(ChatMessage.user_id, func.count(ChatMessage.id))
                .where(ChatMessage.user_id.in_(user_ids))
                .where(ChatMessage.direction == MessageDirection.inbound)
                .where(ChatMessage.admin_seen_at.is_(None))
                .group_by(ChatMessage.user_id)
            )
            unread_by_user_id = {int(uid): int(cnt) for uid, cnt in unread_rows.all()}

        items: list[UserOut] = []
        for u in users:
            stage = stage_by_user_id.get(u.id)
            support_admin = (
                admin_by_id.get(int(getattr(u, "support_admin_id")))
                if getattr(u, "support_admin_id", None)
                else None
            )
            if support_admin is not None and int(support_admin.id) in super_admin_ids:
                support_admin = None
            items.append(
                UserOut(
                    id=u.id,
                    tg_id=int(u.tg_id),
                    username=u.username,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    language_code=getattr(u, "language_code", None),
                    support_enabled=bool(getattr(u, "support_enabled", False)),
                    support_enabled_until=(
                        getattr(u, "support_enabled_until", None).isoformat()
                        if getattr(u, "support_enabled_until", None)
                        else None
                    ),
                    support_admin=(
                        _admin_short(support_admin)
                        if support_admin is not None
                        else None
                    ),
                    photo_file_id=getattr(u, "photo_file_id", None),
                    active_lead_id=stage[0] if stage else None,
                    active_service_title=stage[1] if stage else None,
                    active_question_text=stage[2] if stage else None,
                    updated_at=(
                        u.updated_at.isoformat()
                        if getattr(u, "updated_at", None)
                        else None
                    ),
                    unread_count=unread_by_user_id.get(u.id, 0),
                )
            )
        return UserListOut(items=items)

    @app.patch("/api/users/{user_id}")
    async def patch_user(
        user_id: int,
        payload: UserPatch,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> UserOut:
        u = await db.get(User, user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="Not found")

        now = datetime.now(timezone.utc)
        if (
            bool(getattr(u, "support_enabled", False))
            and getattr(u, "support_enabled_until", None) is not None
        ):
            if getattr(u, "support_enabled_until") <= now:
                u.support_enabled = False
                u.support_enabled_at = None
                u.support_enabled_until = None
                u.support_admin_id = None

        prev_support = bool(getattr(u, "support_enabled", False))
        if payload.support_enabled is not None:
            if payload.support_enabled:
                if (
                    bool(getattr(u, "support_enabled", False))
                    and getattr(u, "support_admin_id", None) is not None
                    and admin is not None
                    and int(getattr(u, "support_admin_id")) != int(admin.id)
                ):
                    raise HTTPException(
                        status_code=409, detail="Цей чат вже в роботі іншого оператора."
                    )
                u.support_enabled = True
                u.support_enabled_at = now
                u.support_enabled_until = await support_expires_at(db)
                u.support_admin_id = int(admin.id) if admin is not None else None
            else:
                if (
                    bool(getattr(u, "support_enabled", False))
                    and getattr(u, "support_admin_id", None) is not None
                    and admin is not None
                    and int(getattr(u, "support_admin_id")) != int(admin.id)
                ):
                    raise HTTPException(
                        status_code=403, detail="Цей чат вже в роботі іншого оператора."
                    )
                u.support_enabled = False
                u.support_enabled_at = None
                u.support_enabled_until = None
                u.support_admin_id = None

        u.updated_at = datetime.utcnow()
        await db.commit()

        if (
            payload.support_enabled is not None
            and bool(payload.support_enabled) != prev_support
        ):
            chat_id = getattr(u, "last_chat_id", None) or u.tg_id
            if payload.support_enabled:
                text = "До вас підключився менеджер.\nТепер ви спілкуєтесь з менеджером у цьому чаті."
            else:
                text = "Менеджер відключився.\nВаші нові повідомлення більше не відображаються менеджеру."

            bot = build_bot()
            try:
                tg_msg = await bot.send_message(chat_id=chat_id, text=text)
            except Exception:
                tg_msg = None
            finally:
                await bot.session.close()

            try:
                await ChatRepository(db).add_outbound(
                    user_id=u.id,
                    text=text,
                    tg_message_id=(
                        getattr(tg_msg, "message_id", None) if tg_msg else None
                    ),
                    admin_id=int(admin.id) if admin is not None else None,
                )
                await db.commit()
            except Exception:
                await db.rollback()

        stage = None
        lead_rn = (
            func.row_number()
            .over(partition_by=Lead.user_id, order_by=Lead.id.desc())
            .label("rn")
        )
        lead_sub = (
            select(
                Lead.user_id.label("user_id"),
                Lead.id.label("lead_id"),
                Lead.service_id.label("service_id"),
                Lead.current_question_id.label("current_question_id"),
                lead_rn,
            )
            .where(Lead.status == LeadStatus.filling)
            .where(Lead.user_id == u.id)
            .subquery()
        )
        lead_rows = await db.execute(
            select(lead_sub.c.lead_id, Service.title, Question.text)
            .join(Service, Service.id == lead_sub.c.service_id)
            .outerjoin(Question, Question.id == lead_sub.c.current_question_id)
            .where(lead_sub.c.rn == 1)
        )
        row = lead_rows.first()
        if row is not None:
            stage = (
                int(row[0]),
                str(row[1]),
                str(row[2]) if row[2] is not None else None,
            )

        support_admin = None
        if getattr(u, "support_admin_id", None):
            support_admin = await db.get(
                AdminAccount, int(getattr(u, "support_admin_id"))
            )
        if (
            support_admin is not None
            and not is_super_admin(admin)
            and bool(getattr(support_admin, "is_super", False))
        ):
            support_admin = None

        return UserOut(
            id=u.id,
            tg_id=int(u.tg_id),
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            language_code=getattr(u, "language_code", None),
            support_enabled=bool(getattr(u, "support_enabled", False)),
            support_enabled_until=(
                getattr(u, "support_enabled_until", None).isoformat()
                if getattr(u, "support_enabled_until", None)
                else None
            ),
            support_admin=(
                _admin_short(support_admin) if support_admin is not None else None
            ),
            photo_file_id=getattr(u, "photo_file_id", None),
            active_lead_id=stage[0] if stage else None,
            active_service_title=stage[1] if stage else None,
            active_question_text=stage[2] if stage else None,
            updated_at=(
                u.updated_at.isoformat() if getattr(u, "updated_at", None) else None
            ),
        )

    @app.get(
        "/api/users/{user_id}/messages", dependencies=[Depends(require_admin_token)]
    )
    async def list_user_messages(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        limit: int = 50,
        before_id: int | None = None,
        after_id: int | None = None,
        admin: Annotated[AdminAccount | None, Depends(require_admin)] = None,
    ) -> ChatMessagesOut:
        limit = min(max(int(limit), 1), 200)
        u = await db.get(User, user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(timezone.utc)
        if (
            bool(getattr(u, "support_enabled", False))
            and getattr(u, "support_enabled_until", None) is not None
        ):
            if getattr(u, "support_enabled_until") <= now:
                u.support_enabled = False
                u.support_enabled_at = None
                u.support_enabled_until = None
                u.support_admin_id = None
                u.updated_at = datetime.utcnow()
                await db.commit()

        if after_id is not None:
            items = await ChatRepository(db).list_messages_after(
                user_id=user_id, after_id=int(after_id), limit=limit
            )
        else:
            items = await ChatRepository(db).list_messages(
                user_id=user_id, limit=limit, before_id=before_id
            )

        super_admin_ids: set[int] = set()
        if not is_super_admin(admin):
            super_admin_ids = await get_super_admin_ids(db)

        items_view = items
        if super_admin_ids:
            filtered: list[ChatMessage] = []
            for m in items:
                admin_id = getattr(m, "admin_id", None)
                if admin_id is not None and int(admin_id) in super_admin_ids:
                    continue
                filtered.append(m)
            items_view = filtered

        admin_by_id: dict[int, AdminAccount] = {}
        admin_ids = {
            int(getattr(m, "admin_id"))
            for m in items_view
            if getattr(m, "admin_id", None)
        }
        if admin_ids:
            ares = await db.execute(
                select(AdminAccount).where(AdminAccount.id.in_(admin_ids))
            )
            admin_by_id = {int(a.id): a for a in ares.scalars().all()}

        try:
            up_to = items[-1].id if items else None
            await ChatRepository(db).mark_inbound_admin_seen(
                user_id=user_id, up_to_id=up_to
            )
            await db.commit()
        except Exception:
            await db.rollback()

        return ChatMessagesOut(
            items=[
                ChatMessageOut(
                    id=m.id,
                    direction=(
                        m.direction.value
                        if isinstance(m.direction, MessageDirection)
                        else str(m.direction)
                    ),
                    text=m.text or "",
                    tg_message_id=m.tg_message_id,
                    admin_tg_id=m.admin_tg_id,
                    admin_id=getattr(m, "admin_id", None),
                    admin=(
                        _admin_short(admin_by_id[int(getattr(m, "admin_id"))])
                        if getattr(m, "admin_id", None)
                        and int(getattr(m, "admin_id")) in admin_by_id
                        else None
                    ),
                    created_at=m.created_at.isoformat() if m.created_at else "",
                    seen_at=(
                        m.seen_at.isoformat() if getattr(m, "seen_at", None) else None
                    ),
                    admin_seen_at=(
                        m.admin_seen_at.isoformat()
                        if getattr(m, "admin_seen_at", None)
                        else None
                    ),
                )
                for m in items_view
            ]
        )

    @app.delete(
        "/api/users/{user_id}/messages", dependencies=[Depends(require_admin_token)]
    )
    async def clear_user_messages(
        user_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if not is_super_admin(admin):
            raise HTTPException(status_code=403, detail="Only super admin can clear chat history")

        await db.execute(delete(ChatMessage).where(ChatMessage.user_id == int(user_id)))
        await db.commit()
        return {"ok": True}

    @app.get("/api/users/{user_id}/photo", dependencies=[Depends(require_admin_token)])
    async def user_photo(
        user_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> Response:
        u = await db.get(User, user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="User not found")

        file_id = getattr(u, "photo_file_id", None)
        if not file_id:
            raise HTTPException(status_code=404, detail="No photo")

        content, media_type = await fetch_telegram_file_bytes(str(file_id))
        return Response(
            content=content,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )

    @app.post("/api/users/{user_id}/send")
    async def send_to_user(
        user_id: int,
        payload: SendMessageIn,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> ChatMessageOut:
        text = (payload.text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Empty message")

        u = await db.get(User, user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(timezone.utc)
        if (
            bool(getattr(u, "support_enabled", False))
            and getattr(u, "support_enabled_until", None) is not None
        ):
            if getattr(u, "support_enabled_until") <= now:
                u.support_enabled = False
                u.support_enabled_at = None
                u.support_enabled_until = None
                u.support_admin_id = None
                u.updated_at = datetime.utcnow()
                await db.commit()

        if not bool(getattr(u, "support_enabled", False)):
            raise HTTPException(
                status_code=403,
                detail="Спочатку увімкніть підтримку для цього користувача.",
            )

        if admin is not None and getattr(u, "support_admin_id", None) is not None:
            if int(getattr(u, "support_admin_id")) != int(admin.id):
                raise HTTPException(
                    status_code=403, detail="Цей чат вже в роботі іншого оператора."
                )

        if admin is not None and getattr(u, "support_admin_id", None) is None:
            u.support_admin_id = int(admin.id)
        u.support_enabled_until = await support_expires_at(db)
        u.updated_at = datetime.utcnow()
        await db.commit()

        chat_id = getattr(u, "last_chat_id", None) or u.tg_id
        bot = build_bot()
        try:
            tg_msg = await bot.send_message(chat_id=chat_id, text=text)
        finally:
            await bot.session.close()

        msg = await ChatRepository(db).add_outbound(
            user_id=u.id,
            text=text,
            tg_message_id=getattr(tg_msg, "message_id", None),
            admin_id=int(admin.id) if admin is not None else None,
        )
        await db.commit()
        return ChatMessageOut(
            id=msg.id,
            direction=msg.direction.value,
            text=msg.text,
            tg_message_id=msg.tg_message_id,
            admin_tg_id=msg.admin_tg_id,
            admin_id=getattr(msg, "admin_id", None),
            admin=_admin_short(admin) if admin is not None else None,
            created_at=msg.created_at.isoformat() if msg.created_at else "",
            seen_at=msg.seen_at.isoformat() if getattr(msg, "seen_at", None) else None,
            admin_seen_at=(
                msg.admin_seen_at.isoformat()
                if getattr(msg, "admin_seen_at", None)
                else None
            ),
        )
