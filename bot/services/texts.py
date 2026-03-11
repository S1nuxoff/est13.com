from __future__ import annotations

from pathlib import Path

from aiogram.types import FSInputFile, Message
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.config import get_settings
from est13_core.db.models.bot_text import BotText


def _text_or_default(value: str | None, default: str) -> str:
    if not value:
        return default
    # Heuristic: common mojibake markers when UTF-8 text was accidentally shown/decoded incorrectly.
    if any(ch in value for ch in ("Đ", "Ń", "â")):
        return default
    if any(0x80 <= ord(ch) <= 0x9F for ch in value):
        return default
    return value


BASE_DEFAULT_TEXTS: dict[str, str] = {
    # /start
    "greeting": "Вітаємо! 👋",
    "greeting_new": "Вітаємо! 👋\nОберіть послугу нижче, щоб заповнити бриф.",
    "greeting_back": "Раді бачити вас знову! 👋\nОберіть послугу нижче.",
    "choose_service": "Оберіть послугу:",
    "btn_my_leads": "📋 Мої заявки",
    # Support / flows
    "support_paused": "Зараз з вами на зв’язку менеджер.\nПоки підтримка увімкнена, заповнення брифу тимчасово призупинено.",
    "resume_unfinished": "У вас є незавершена анкета (<b>{title}</b>). Продовжуємо.",
    "service_intro": "Послуга: <b>{title}</b>\nВідповідайте на питання нижче.",
    # Navigation / session
    "btn_back": "⬅️ Назад",
    "btn_cancel": "Скасувати",
    "btn_menu": "🏠 Меню",
    "btn_back_to_menu": "⬅️ Назад до меню",
    "session_lost": "Сесію втрачено. Натисніть /start.",
    "first_question": "Це перше питання.",
    "lead_cancelled": "Ок, скасовано.",
    "cancel_cmd_done": "Ок, скасовано. Натисніть /start щоб почати заново.",
    # Questions
    "question_prefix_total": "Питання {step} з {total}\n\n",
    "question_prefix": "Питання {step}\n\n",
    "err_next_question": "Не вдалося завантажити наступне питання. Натисніть /start.",
    "err_load_question": "Не вдалося завантажити питання. Натисніть /start.",
    "err_choose_option": "Будь ласка, оберіть варіант кнопкою нижче.",
    "err_answer_required": "Відповідь не може бути порожньою. Спробуйте ще раз.",
    "thanks": "Дякуємо! Заявку прийнято.",
    # Service/graph errors
    "err_service_unavailable": "Ця послуга недоступна. Натисніть /start.",
    "err_user_identify": "Не вдалося визначити користувача. Натисніть /start.",
    "err_service_not_configured": "Ця послуга ще не налаштована. Спробуйте іншу.",
    "err_flow_not_configured": "Сценарій цієї послуги ще не налаштований (немає переходу або END). Оберіть іншу послугу.",
    # My leads
    "my_leads_title": "📋 <b>Мої заявки</b>",
    "my_leads_empty": "Поки що немає заявок.",
    "my_leads_choose": "Оберіть заявку, щоб подивитися деталі:",
    "err_profile_not_found": "Не вдалося знайти ваш профіль. Натисніть /start.",
    "err_lead_not_found": "Заявка не знайдена.",
    "my_lead_details": (
        "🧾 <b>Заявка №{id}</b>\n"
        "Послуга: <b>{service}</b>\n"
        "Статус: <b>{status}</b>\n\n"
        "Створено: {created}\n"
        "Надіслано: {submitted}\n"
    ),
    "my_lead_events_title": "<b>Останні зміни</b>",
    "btn_client_ok": "✅ Підтверджую",
    "btn_client_changes": "✍️ Потрібні правки",
    # Client feedback
    "client_action_unavailable": "Ця дія вже недоступна.",
    "client_ok_thanks": "Дякуємо! ✅ Ми зафіксували підтвердження. Заявку закрито.",
    "client_changes_thanks": "Дякуємо! ✍️ Ми зафіксували, що потрібні правки. Менеджер зв’яжеться з вами.",
    "admin_notify_client_ok": "✅ Клієнт підтвердив результат по заявці #{id}.",
    "admin_notify_client_changes": "✍️ Клієнт просить правки по заявці #{id}.",
    # Inbox / chat
    "msg_forwarded_to_manager": "Повідомлення передано менеджеру.",
    "admin_inbox_msg": "Повідомлення від користувача {tg_id}:\n{text}",
    "admin_inbox_header": "Нове повідомлення від користувача",
    "admin_inbox_suffix_off": "(поза брифом / підтримка вимкнена)",
    "admin_inbox_suffix_on": "(підтримка увімкнена)",
    "admin_inbox_active_lead": "Є активна анкета: заявка #{id}",
    "admin_inbox_message": (
        "{header}\n" "• tg: <code>{tg}</code>\n" "• ім’я: {name}\n\n" "{preview}"
    ),
    "auto_reply_outside_support": "Дякуємо! Ми отримали ваше повідомлення.\nМенеджер відповість, щойно буде на зв’язку.",
    # Admin telegram / misc
    "admin_recent_leads": "Останні заявки:",
    "admin_no_leads": "Заявок поки немає.",
    "admin_lead_summary_title": "Заявка #{id}",
    "admin_lead_summary_item": "• {q}\n  {a}",
    # Health
    "health_ok": "OK",
    # Status labels (bot-facing)
    "lead_status_filling": "Заповнює",
    "lead_status_abandoned": "Скасовано (клієнт)",
    "lead_status_awaiting_review": "Очікує перевірки",
    "lead_status_in_review": "На перевірці",
    "lead_status_confirmed": "Підтверджено",
    "lead_status_in_work": "В роботі",
    "lead_status_paused": "Пауза",
    "lead_status_rejected": "Відхилено",
    "lead_status_lost": "Втрачено",
    "lead_status_studio_cancelled": "Скасовано (студія)",
    "lead_status_done": "Завершено",
    "lead_status_delivered": "Передано клієнту",
    "lead_status_client_not_confirmed": "Клієнт не підтвердив",
    "lead_status_closed": "Закрито",
}


class Texts:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._obj_cache: dict[str, BotText | None] = {}

    async def _get_obj_cached(
        self, key: str, default: str | None = None
    ) -> BotText | None:
        if key in self._obj_cache:
            obj = self._obj_cache[key]
            if obj is None and default is not None:
                obj = BotText(key=key, value=default)
                self._db.add(obj)
                self._obj_cache[key] = obj
            return obj

        obj = await self._db.get(BotText, key)
        if obj is None and default is not None:
            obj = BotText(key=key, value=default)
            self._db.add(obj)
        self._obj_cache[key] = obj
        return obj

    async def ensure_base(self) -> None:
        keys = list(BASE_DEFAULT_TEXTS.keys())
        if not keys:
            return

        result = await self._db.execute(select(BotText).where(BotText.key.in_(keys)))
        existing_objs = list(result.scalars().all())
        existing = {o.key for o in existing_objs}
        for o in existing_objs:
            self._obj_cache[o.key] = o
        for key, value in BASE_DEFAULT_TEXTS.items():
            if key in existing:
                continue
            obj = BotText(key=key, value=value)
            self._db.add(obj)
            self._obj_cache[key] = obj

    async def t(self, key: str, default: str) -> str:
        obj = await self._get_obj_cached(key, default=default)
        return _text_or_default(getattr(obj, "value", None), default)

    async def obj(self, key: str, default: str | None = None):
        return await self._get_obj_cached(key, default=default)

    async def send(
        self, message: Message, *, key: str, default: str, allow_photo: bool = False
    ) -> None:
        obj = await self._get_obj_cached(key, default=default)
        text = _text_or_default(getattr(obj, "value", None), default)
        if allow_photo:
            rel = getattr(obj, "photo_path", None) if obj else None
            if rel:
                abs_path = Path(get_settings().media_dir) / str(rel)
                if abs_path.exists():
                    # Photo captions are limited to 1024 characters.
                    if len(text) <= 1024:
                        await message.answer_photo(
                            photo=FSInputFile(abs_path), caption=text
                        )
                    else:
                        await message.answer_photo(photo=FSInputFile(abs_path))
                        await message.answer(text)
                    return

        await message.answer(text)
