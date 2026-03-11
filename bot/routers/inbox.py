from __future__ import annotations

import logging

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.filters.state import StateFilter
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.repositories.admin_user import AdminUserRepository
from est13_core.db.repositories.chat import ChatRepository
from est13_core.db.repositories.lead import LeadRepository
from est13_core.db.repositories.user import UserRepository
from bot.services.texts import Texts
from bot.services.user_service import UserService

router = Router(name="inbox")
logger = logging.getLogger("est13_bot.inbox")


@router.message(
    F.chat.type == "private",
    StateFilter(None),
    ~Command(commands=["start", "cancel", "admin", "health"]),
)
async def inbox_message(message: Message, db: AsyncSession, bot: Bot) -> None:
    if message.from_user is None:
        return
    texts = Texts(db)

    users = UserRepository(db)
    user_service = UserService(users)
    user = await user_service.upsert_from_telegram_user(
        message.from_user, chat_id=message.chat.id
    )
    if user is None:
        return

    # Auto-disable support if it was left enabled for too long.
    try:
        if await users.auto_disable_support_if_expired(user):
            await db.commit()
    except Exception:
        await db.rollback()

    # Try to cache avatar file_id (best-effort)
    if not user.photo_file_id:
        file_id, uniq = await user_service.try_update_avatar(
            bot, user_tg_id=message.from_user.id
        )
        if file_id:
            user.photo_file_id = file_id
            user.photo_file_unique_id = uniq

    text = (message.text or message.caption or "").strip()
    if not text:
        # skip non-text for now (stickers/photos/etc.)
        return

    # Best-effort: if user replied, consider previous outbound messages "seen".
    try:
        await ChatRepository(db).mark_outbound_seen(user_id=user.id)
    except Exception:
        pass

    await ChatRepository(db).add_inbound(
        user_id=user.id,
        text=text,
        tg_message_id=message.message_id,
    )
    await db.commit()

    admin_ids = await AdminUserRepository(db).list_active_tg_ids()
    preview = text if len(text) <= 1200 else (text[:1200] + "…")

    # Detect whether user has an active (in_progress) brief right now.
    active = None
    try:
        active = await LeadRepository(db).get_active_for_user(user.id)
    except Exception:
        active = None

    header = await texts.t("admin_inbox_header", "Нове повідомлення від користувача")
    if not bool(getattr(user, "support_enabled", False)):
        header += " " + await texts.t(
            "admin_inbox_suffix_off", "(поза брифом / підтримка вимкнена)"
        )
    else:
        header += " " + await texts.t("admin_inbox_suffix_on", "(підтримка увімкнена)")
    if active is not None:
        active_tpl = await texts.t(
            "admin_inbox_active_lead", "Є активна анкета: заявка #{id}"
        )
        header += "\n" + active_tpl.format(id=active.id)

    admin_msg_tpl = await texts.t(
        "admin_inbox_message",
        "{header}\n" "• tg: <code>{tg}</code>\n" "• ім’я: {name}\n\n" "{preview}",
    )

    for admin_tg_id in admin_ids:
        try:
            await bot.send_message(
                admin_tg_id,
                admin_msg_tpl.format(
                    header=header,
                    tg=user.tg_id,
                    name=f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip(),
                    preview=preview,
                ),
            )
        except Exception:
            logger.exception("Failed to notify admin %s", admin_tg_id)

    if not bool(getattr(user, "support_enabled", False)):
        # Best-effort auto-reply so user knows what happens.
        try:
            await message.answer(
                await texts.t(
                    "auto_reply_outside_support",
                    "Дякуємо! Ми отримали ваше повідомлення.\nМенеджер відповість, щойно буде на зв’язку.",
                )
            )
        except Exception:
            pass
