from __future__ import annotations

import logging

from aiogram import Bot, F, Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.enums import LeadStatus
from est13_core.db.repositories.admin_user import AdminUserRepository
from est13_core.db.repositories.lead import LeadRepository
from est13_core.db.repositories.user import UserRepository
from bot.services.texts import Texts

router = Router(name="client_feedback")
logger = logging.getLogger("est13_bot.client_feedback")


@router.callback_query(F.data.startswith("lead:client_ok:"))
async def client_ok(call: CallbackQuery, db: AsyncSession) -> None:
    await call.answer()
    texts = Texts(db)
    if call.from_user is None:
        return
    try:
        lead_id = int(call.data.split(":")[-1])
    except Exception:
        return

    user = await UserRepository(db).get_by_tg_id(call.from_user.id)
    if user is None:
        return

    leads = LeadRepository(db)
    lead = await leads.get(lead_id)
    if lead is None or int(lead.user_id) != int(user.id):
        return

    if lead.status != LeadStatus.delivered:
        if call.message:
            await call.message.answer(
                await texts.t("client_action_unavailable", "Ця дія вже недоступна.")
            )
        return

    await leads.set_status(lead_id, LeadStatus.closed, admin_id=None)
    await db.commit()

    if call.message:
        await call.message.answer(
            await texts.t(
                "client_ok_thanks",
                "Дякуємо! ✅ Ми зафіксували підтвердження. Заявку закрито.",
            )
        )

    admin_ids = await AdminUserRepository(db).list_active_tg_ids()
    for admin_tg_id in admin_ids:
        try:
            tpl = await texts.t(
                "admin_notify_client_ok",
                "✅ Клієнт підтвердив результат по заявці #{id}.",
            )
            await call.bot.send_message(admin_tg_id, tpl.format(id=lead_id))
        except Exception:
            logger.exception("Failed to notify admin %s", admin_tg_id)


@router.callback_query(F.data.startswith("lead:client_changes:"))
async def client_changes(call: CallbackQuery, db: AsyncSession) -> None:
    await call.answer()
    texts = Texts(db)
    if call.from_user is None:
        return
    try:
        lead_id = int(call.data.split(":")[-1])
    except Exception:
        return

    user = await UserRepository(db).get_by_tg_id(call.from_user.id)
    if user is None:
        return

    leads = LeadRepository(db)
    lead = await leads.get(lead_id)
    if lead is None or int(lead.user_id) != int(user.id):
        return

    if lead.status != LeadStatus.delivered:
        if call.message:
            await call.message.answer(
                await texts.t("client_action_unavailable", "Ця дія вже недоступна.")
            )
        return

    await leads.set_status(lead_id, LeadStatus.client_not_confirmed, admin_id=None)
    await db.commit()

    if call.message:
        await call.message.answer(
            await texts.t(
                "client_changes_thanks",
                "Дякуємо! ✍️ Ми зафіксували, що потрібні правки. Менеджер зв’яжеться з вами.",
            )
        )

    admin_ids = await AdminUserRepository(db).list_active_tg_ids()
    for admin_tg_id in admin_ids:
        try:
            tpl = await texts.t(
                "admin_notify_client_changes",
                "✍️ Клієнт просить правки по заявці #{id}.",
            )
            await call.bot.send_message(admin_tg_id, tpl.format(id=lead_id))
        except Exception:
            logger.exception("Failed to notify admin %s", admin_tg_id)
