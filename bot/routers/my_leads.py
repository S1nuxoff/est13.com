from __future__ import annotations

from datetime import datetime

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.lead_event import LeadEvent
from est13_core.db.models.service import Service
from est13_core.db.repositories.lead import LeadRepository
from est13_core.db.repositories.user import UserRepository
from bot.routers.leads import _send_services_menu
from bot.services.texts import Texts

router = Router(name="my_leads")


def _fmt_dt(dt: datetime | None) -> str:
    if not dt:
        return "—"
    try:
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return str(dt)


DEFAULT_STATUS_LABEL: dict[str, str] = {
    "filling": "Заповнює",
    "abandoned": "Скасовано (клієнт)",
    "awaiting_review": "Очікує перевірки",
    "in_review": "На перевірці",
    "confirmed": "Підтверджено",
    "in_work": "В роботі",
    "paused": "Пауза",
    "rejected": "Відхилено",
    "lost": "Втрачено",
    "studio_cancelled": "Скасовано (студія)",
    "done": "Завершено",
    "delivered": "Передано клієнту",
    "client_not_confirmed": "Клієнт не підтвердив",
    "closed": "Закрито",
}


def _lead_list_kb(
    items: list[tuple[int, str, str]], *, back_to_menu_text: str
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for lead_id, title, status in items[:20]:
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"№{lead_id} • {title} • {status}",
                    callback_data=f"my_leads:open:{lead_id}",
                )
            ]
        )
    rows.append(
        [InlineKeyboardButton(text=back_to_menu_text, callback_data="menu:services")]
    )
    return InlineKeyboardMarkup(
        inline_keyboard=rows or [[InlineKeyboardButton(text="—", callback_data="noop")]]
    )


def _details_kb(
    lead_id: int,
    *,
    show_client_feedback: bool,
    back_text: str,
    menu_text: str,
    client_ok_text: str,
    client_changes_text: str,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    if show_client_feedback:
        rows.append(
            [
                InlineKeyboardButton(
                    text=client_ok_text, callback_data=f"lead:client_ok:{lead_id}"
                )
            ]
        )
        rows.append(
            [
                InlineKeyboardButton(
                    text=client_changes_text,
                    callback_data=f"lead:client_changes:{lead_id}",
                )
            ]
        )
    rows.append([InlineKeyboardButton(text=back_text, callback_data="my_leads:list")])
    rows.append([InlineKeyboardButton(text=menu_text, callback_data="menu:services")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _render_list(message: Message, db: AsyncSession, *, tg_id: int) -> None:
    texts = Texts(db)
    user = await UserRepository(db).get_by_tg_id(int(tg_id))
    if user is None:
        await message.answer(
            await texts.t(
                "err_profile_not_found",
                "Не вдалося знайти ваш профіль. Натисніть /start.",
            )
        )
        return

    rows = await LeadRepository(db).list_for_user(user_id=user.id, limit=20)
    items = []
    for lead_id, title, status, started_at, submitted_at, accepted_at in rows:
        status_value = getattr(status, "value", str(status))
        default_label = DEFAULT_STATUS_LABEL.get(status_value, status_value)
        label = await texts.t(f"lead_status_{status_value}", default_label)
        items.append((lead_id, title, label))

    header = await texts.t("my_leads_title", "📋 <b>Мої заявки</b>")
    text = header + "\n\n"
    if not items:
        text += await texts.t("my_leads_empty", "Поки що немає заявок.")
        await message.answer(text)
        await _send_services_menu(message, db)
        return

    text += await texts.t("my_leads_choose", "Оберіть заявку, щоб подивитися деталі:")
    back_to_menu_text = await texts.t("btn_back_to_menu", "⬅️ Назад до меню")
    await message.answer(
        text, reply_markup=_lead_list_kb(items, back_to_menu_text=back_to_menu_text)
    )


@router.message(Command("my"))
@router.message(Command("leads"))
async def my_leads_cmd(message: Message, db: AsyncSession) -> None:
    if message.from_user is None:
        return
    await _render_list(message, db, tg_id=message.from_user.id)


@router.callback_query(F.data == "my_leads:list")
async def my_leads_list(call: CallbackQuery, db: AsyncSession) -> None:
    await call.answer()
    if call.message is None or call.from_user is None:
        return
    # Reuse rendering via message.answer to avoid editing problems with older messages.
    await _render_list(call.message, db, tg_id=call.from_user.id)


@router.callback_query(F.data == "menu:services")
async def menu_services(call: CallbackQuery, db: AsyncSession) -> None:
    await call.answer()
    if call.message is None:
        return
    await _send_services_menu(call.message, db)


@router.callback_query(F.data.startswith("my_leads:open:"))
async def my_leads_open(call: CallbackQuery, db: AsyncSession) -> None:
    await call.answer()
    if call.from_user is None or call.message is None:
        return
    texts = Texts(db)
    try:
        lead_id = int(call.data.split(":")[-1])
    except Exception:
        return

    user = await UserRepository(db).get_by_tg_id(call.from_user.id)
    if user is None:
        await call.message.answer(
            await texts.t(
                "err_profile_not_found",
                "Не вдалося знайти ваш профіль. Натисніть /start.",
            )
        )
        return

    lead = await LeadRepository(db).get(lead_id)
    if lead is None or int(lead.user_id) != int(user.id):
        await call.message.answer(
            await texts.t("err_lead_not_found", "Заявка не знайдена.")
        )
        return

    service = await db.get(Service, int(lead.service_id))
    status_value = getattr(lead.status, "value", str(lead.status))
    status_label = await texts.t(
        f"lead_status_{status_value}",
        DEFAULT_STATUS_LABEL.get(status_value, status_value),
    )

    # Timeline (latest events)
    ev_rows = await db.execute(
        select(LeadEvent.to_status, LeadEvent.created_at)
        .where(LeadEvent.lead_id == int(lead_id))
        .order_by(LeadEvent.created_at.desc(), LeadEvent.id.desc())
        .limit(10)
    )
    ev_lines = []
    for st, created_at in ev_rows.all():
        sv = getattr(st, "value", str(st))
        default_label = DEFAULT_STATUS_LABEL.get(sv, sv)
        label = await texts.t(f"lead_status_{sv}", default_label)
        ev_lines.append(f"• {_fmt_dt(created_at)} — {label}")
    details_tpl = await texts.t(
        "my_lead_details",
        "🧾 <b>Заявка №{id}</b>\n"
        "Послуга: <b>{service}</b>\n"
        "Статус: <b>{status}</b>\n\n"
        "Створено: {created}\n"
        "Надіслано: {submitted}\n",
    )
    text = details_tpl.format(
        id=lead.id,
        service=(service.title if service else ""),
        status=status_label,
        created=_fmt_dt(getattr(lead, "started_at", None)),
        submitted=_fmt_dt(getattr(lead, "submitted_at", None)),
    )
    if ev_lines:
        text += (
            "\n"
            + await texts.t("my_lead_events_title", "<b>Останні зміни</b>")
            + "\n"
            + "\n".join(ev_lines)
        )

    show_feedback = status_value == "delivered"
    await call.message.answer(
        text,
        reply_markup=_details_kb(
            int(lead.id),
            show_client_feedback=show_feedback,
            back_text=await texts.t("btn_back", "⬅️ Назад"),
            menu_text=await texts.t("btn_menu", "🏠 Меню"),
            client_ok_text=await texts.t("btn_client_ok", "✅ Підтверджую"),
            client_changes_text=await texts.t(
                "btn_client_changes", "✍️ Потрібні правки"
            ),
        ),
    )
