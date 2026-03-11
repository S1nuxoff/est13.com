from __future__ import annotations

from aiogram import Bot, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.repositories.chat import ChatRepository
from est13_core.db.repositories.lead import LeadRepository
from est13_core.db.repositories.service import ServiceRepository
from est13_core.db.repositories.user import UserRepository
from bot.routers.leads import ask_question, _send_services_menu
from bot.services.texts import Texts
from bot.services.user_service import UserService
from bot.states import LeadStates

router = Router(name="start")


@router.message(CommandStart())
async def start_cmd(
    message: Message, db: AsyncSession, state: FSMContext, bot: Bot
) -> None:
    texts = Texts(db)
    await texts.ensure_base()

    user_repo = UserRepository(db)
    user_service = UserService(user_repo)

    existed_user = (
        await user_repo.get_by_tg_id(message.from_user.id)
        if message.from_user is not None
        else None
    )
    user = await user_service.upsert_from_telegram_user(
        message.from_user, chat_id=message.chat.id
    )
    is_new_user = existed_user is None

    if user is not None:
        try:
            if await user_repo.auto_disable_support_if_expired(user):
                await db.commit()
        except Exception:
            await db.rollback()

    if user is not None and not user.photo_file_id and message.from_user is not None:
        file_id, uniq = await user_service.try_update_avatar(
            bot, user_tg_id=message.from_user.id
        )
        if file_id:
            user.photo_file_id = file_id
            user.photo_file_unique_id = uniq

    if user is not None:
        try:
            await ChatRepository(db).mark_outbound_seen(user_id=user.id)
            await db.commit()
        except Exception:
            await db.rollback()

    if user is not None and bool(getattr(user, "support_enabled", False)):
        await message.answer(
            await texts.t(
                "support_paused",
                "Зараз з вами на зв’язку менеджер.\n"
                "Поки підтримка увімкнена, заповнення брифу тимчасово призупинено.",
            )
        )
        return

    # If user has an unfinished lead, resume it instead of starting a new one.
    if user is not None:
        active = await LeadRepository(db).get_active_for_user(user.id)
        active_qid = (
            getattr(active, "current_question_id", None) if active is not None else None
        )
        if active is not None and isinstance(active_qid, int):
            active_service = await ServiceRepository(db).get(active.service_id)
            await state.set_state(LeadStates.collecting)
            await state.update_data(
                lead_id=active.id, service_id=active.service_id, question_id=active_qid
            )
            title = active_service.title if active_service else "вашої анкети"
            resume_tpl = await texts.t(
                "resume_unfinished",
                "У вас є незавершена анкета (<b>{title}</b>). Продовжуємо.",
            )
            await message.answer(resume_tpl.format(title=title))
            await ask_question(message, db, lead_id=active.id, question_id=active_qid)
            return

    await state.clear()

    greeting_key = "greeting_new" if is_new_user else "greeting_back"
    default_greeting = (
        "Вітаємо! 👋\nОберіть послугу нижче, щоб заповнити бриф."
        if is_new_user
        else "Раді бачити вас знову! 👋\nОберіть послугу нижче."
    )

    # Ensure both keys exist in admin Texts.
    await texts.t("greeting", "Вітаємо! 👋")
    await texts.t(
        "greeting_new", "Вітаємо! 👋\nОберіть послугу нижче, щоб заповнити бриф."
    )
    await texts.t("greeting_back", "Раді бачити вас знову! 👋\nОберіть послугу нижче.")

    await texts.send(
        message, key=greeting_key, default=default_greeting, allow_photo=True
    )
    await _send_services_menu(message, db)
