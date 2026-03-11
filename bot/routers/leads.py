from __future__ import annotations

import logging
import secrets
import time
from io import BytesIO
from pathlib import Path

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    CallbackQuery,
    FSInputFile,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.config import get_settings
from est13_core.db.models.enums import LeadSource, LeadStatus, QuestionType
from est13_core.db.repositories.admin_user import AdminUserRepository
from est13_core.db.repositories.chat import ChatRepository
from est13_core.db.repositories.lead import LeadRepository
from est13_core.db.repositories.question import QuestionRepository
from est13_core.db.repositories.service import ServiceRepository
from est13_core.db.repositories.user import UserRepository
from bot.services.user_service import UserService
from bot.states import LeadStates
from bot.services.texts import Texts
from bot.ui.keyboards import nav_rows, options_kb, services_kb

router = Router(name="leads")
logger = logging.getLogger("est13_bot.leads")

DEFAULT_SUPPORT_PAUSED_TEXT = (
    "Зараз з вами на зв’язку менеджер.\n"
    "Поки підтримка увімкнена, заповнення брифу тимчасово призупинено."
)

_READY_SERVICES_CACHE: dict[str, object] = {"ts": 0.0, "items": []}
_READY_SERVICES_TTL_S = 15.0


async def _save_telegram_file_to_media(
    bot: Bot, *, file_id: str, folder: str, prefix: str
) -> str | None:
    settings = get_settings()
    media_dir = Path(settings.media_dir)

    try:
        tg_file = await bot.get_file(file_id)
        suffix = Path(tg_file.file_path or "").suffix or ".jpg"
        filename = f"{prefix}_{secrets.token_hex(8)}{suffix}"
        rel = f"{folder}/{filename}".replace("\\", "/")
        abs_path = media_dir / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)

        buf = BytesIO()
        await bot.download(tg_file, destination=buf)
        abs_path.write_bytes(buf.getvalue())
        return rel
    except Exception:
        logger.exception("Failed to save telegram file to media")
        return None


async def _send_services_menu(message: Message, db: AsyncSession) -> None:
    texts = Texts(db)
    choose_service = await texts.t("choose_service", "Оберіть послугу:")
    services = await ServiceRepository(db).list_active()
    qrepo = QuestionRepository(db)

    async def is_ready(service) -> bool:
        start_qid = getattr(service, "start_question_id", None)
        if not isinstance(start_qid, int):
            return False

        questions = await qrepo.list_for_service(service.id)
        if not questions:
            return False

        by_id = {q.id: q for q in questions}
        if start_qid not in by_id:
            return False

        qids = list(by_id.keys())
        opt_rows = await qrepo.list_options_for_questions(qids)
        opts_by_qid: dict[int, list] = {}
        for o in opt_rows:
            opts_by_qid.setdefault(int(o.question_id), []).append(o)

        seen: set[int] = set()
        stack: list[int] = [start_qid]
        while stack:
            qid = stack.pop()
            if qid in seen:
                continue
            q = by_id.get(qid)
            if q is None:
                return False
            seen.add(qid)

            if q.qtype == QuestionType.single_choice:
                opts = opts_by_qid.get(int(q.id), [])
                if not opts:
                    return False
                for o in opts:
                    nxt = o.next_question_id
                    if nxt is not None:
                        if nxt not in by_id:
                            return False
                        stack.append(nxt)
                    elif not bool(getattr(o, "ends_flow", False)):
                        return False
            else:
                nxt = q.next_question_id
                if nxt is not None:
                    if nxt not in by_id:
                        return False
                    stack.append(nxt)
                elif not bool(getattr(q, "ends_flow", False)):
                    return False

        return True

    now = time.monotonic()
    cached_ts = float(_READY_SERVICES_CACHE.get("ts", 0.0) or 0.0)
    cached_items = _READY_SERVICES_CACHE.get("items", [])
    if isinstance(cached_items, list) and (now - cached_ts) < _READY_SERVICES_TTL_S:
        ready_services = cached_items
    else:
        ready_services: list[tuple[int, str]] = []
        for s in services:
            if await is_ready(s):
                ready_services.append((s.id, s.title))
        _READY_SERVICES_CACHE["ts"] = now
        _READY_SERVICES_CACHE["items"] = ready_services

    btn_my_leads = await texts.t("btn_my_leads", "📋 Мої заявки")
    kb = services_kb(
        ready_services, columns=2, footer_buttons=[(btn_my_leads, "my_leads:list")]
    )

    webapp_url = (get_settings().webapp_url or "").strip()
    if webapp_url:
        btn_open_app = await texts.t("btn_open_app", "🧩 Відкрити міні-апку")
        kb.inline_keyboard.append(
            [
                InlineKeyboardButton(
                    text=btn_open_app, web_app=WebAppInfo(url=webapp_url)
                )
            ]
        )

    await message.answer(choose_service, reply_markup=kb)


async def ask_question(
    message: Message, db: AsyncSession, *, lead_id: int, question_id: int
) -> None:
    texts = Texts(db)
    qrepo = QuestionRepository(db)
    question = await qrepo.get(question_id)
    if question is None:
        await message.answer(
            await texts.t(
                "err_next_question",
                "Не вдалося завантажити наступне питання. Натисніть /start.",
            )
        )
        return

    leads = LeadRepository(db)
    answered = await leads.count_answers(lead_id)
    total = len(await qrepo.list_for_service(question.service_id))
    step = answered + 1
    if total:
        prefix_tpl = await texts.t(
            "question_prefix_total", "Питання {step} з {total}\n\n"
        )
        prefix = prefix_tpl.format(step=step, total=total)
    else:
        prefix_tpl = await texts.t("question_prefix", "Питання {step}\n\n")
        prefix = prefix_tpl.format(step=step)
    prompt_text = prefix + (question.text or "")

    show_back = answered > 0
    back_text = await texts.t("btn_back", "⬅️ Назад")
    cancel_text = await texts.t("btn_cancel", "Скасувати")
    nav = nav_rows(
        show_back=show_back,
        show_cancel=False,
        back_text=back_text,
        cancel_text=cancel_text,
    )
    kb: InlineKeyboardMarkup | None = (
        InlineKeyboardMarkup(inline_keyboard=nav) if nav else None
    )
    if question.qtype == QuestionType.single_choice:
        options = await qrepo.list_options(question.id)
        base = options_kb(
            [(o.id, o.text, o.keyboard_row, o.keyboard_col) for o in options]
        )
        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                *base.inline_keyboard,
                *nav_rows(
                    show_back=show_back,
                    show_cancel=False,
                    back_text=back_text,
                    cancel_text=cancel_text,
                ),
            ]
        )

    photo_path = getattr(question, "photo_path", None)
    if photo_path:
        abs_photo_path = Path(get_settings().media_dir) / str(photo_path)
        if abs_photo_path.exists():
            try:
                # Photo captions are limited to 1024 characters.
                if len(prompt_text) <= 1024:
                    await message.answer_photo(
                        photo=FSInputFile(abs_photo_path),
                        caption=prompt_text,
                        reply_markup=kb,
                    )
                else:
                    await message.answer_photo(photo=FSInputFile(abs_photo_path))
                    await message.answer(prompt_text, reply_markup=kb)
                return
            except Exception:
                logger.exception("Failed to send question photo, falling back to text")

    await message.answer(prompt_text, reply_markup=kb)


async def _resolve_next(
    db: AsyncSession, *, service_id: int, question_id: int, option_id: int | None
) -> tuple[str, int | None]:
    qrepo = QuestionRepository(db)
    question = await qrepo.get(question_id)
    if question is None:
        return ("invalid", None)

    if option_id is not None:
        opt = await qrepo.get_option(option_id)
        if opt and opt.next_question_id:
            nxt = await qrepo.get(opt.next_question_id)
            return ("next", nxt.id if nxt else None)
        if opt and bool(getattr(opt, "ends_flow", False)):
            return ("finish", None)
        return ("invalid", None)

    if question.next_question_id:
        nxt = await qrepo.get(question.next_question_id)
        return ("next", nxt.id if nxt else None)

    if bool(getattr(question, "ends_flow", False)):
        return ("finish", None)

    return ("invalid", None)


async def _finish_lead(bot: Bot, db: AsyncSession, *, lead_id: int) -> None:
    texts = Texts(db)
    leads = LeadRepository(db)
    await leads.set_status(lead_id, LeadStatus.awaiting_review)
    await db.flush()

    answers = await leads.list_answers_for_summary(lead_id)
    title_tpl = await texts.t("admin_lead_summary_title", "Заявка #{id}")
    text_lines = [title_tpl.format(id=lead_id)]
    for q, a in answers:
        item_tpl = await texts.t("admin_lead_summary_item", "• {q}\n  {a}")
        text_lines.append(item_tpl.format(q=q, a=a))
    summary = "\n".join(text_lines)

    admin_ids = await AdminUserRepository(db).list_active_tg_ids()
    for admin_tg_id in admin_ids:
        try:
            await bot.send_message(admin_tg_id, summary)
        except Exception:
            logger.exception("Failed to notify admin %s", admin_tg_id)


@router.callback_query(F.data.startswith("svc:"))
async def service_selected(
    call: CallbackQuery, db: AsyncSession, state: FSMContext, bot: Bot
) -> None:
    await call.answer()
    texts = Texts(db)
    if call.from_user is None:
        return
    try:
        u = await UserRepository(db).get_by_tg_id(call.from_user.id)
        if u is not None:
            await ChatRepository(db).mark_outbound_seen(user_id=u.id)
    except Exception:
        pass

    service_id = int(call.data.split(":", 1)[1])
    service = await ServiceRepository(db).get(service_id)
    if service is None or not service.is_active:
        await call.message.answer(
            await texts.t(
                "err_service_unavailable", "Ця послуга недоступна. Натисніть /start."
            )
        )
        return

    user = await UserService(UserRepository(db)).upsert_from_telegram_user(
        call.from_user,
        chat_id=call.message.chat.id if call.message else None,
    )
    if user is not None and not user.photo_file_id:
        file_id, uniq = await UserService(UserRepository(db)).try_update_avatar(
            bot, user_tg_id=user.tg_id
        )
        if file_id:
            user.photo_file_id = file_id
            user.photo_file_unique_id = uniq
    if user is None:
        await call.message.answer(
            await texts.t(
                "err_user_identify",
                "Не вдалося визначити користувача. Натисніть /start.",
            )
        )
        return

    try:
        if await UserRepository(db).auto_disable_support_if_expired(user):
            await db.commit()
    except Exception:
        await db.rollback()

    if bool(getattr(user, "support_enabled", False)):
        await call.message.answer(
            await texts.t("support_paused", DEFAULT_SUPPORT_PAUSED_TEXT)
        )
        return

    # Prevent starting a new questionnaire while another is in progress: resume instead.
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
        await call.message.answer(resume_tpl.format(title=title))
        await ask_question(call.message, db, lead_id=active.id, question_id=active_qid)
        return

    start_qid = getattr(service, "start_question_id", None)
    if not isinstance(start_qid, int):
        await call.message.answer(
            await texts.t(
                "err_service_not_configured",
                "Ця послуга ще не налаштована. Спробуйте іншу.",
            )
        )
        return
    first_question = await QuestionRepository(db).get(start_qid)
    if first_question is None or first_question.service_id != service_id:
        await call.message.answer(
            await texts.t(
                "err_service_not_configured",
                "Ця послуга ще не налаштована. Спробуйте іншу.",
            )
        )
        return

    lead = await LeadRepository(db).create(
        user_id=user.id, service_id=service_id, source=LeadSource.bot
    )
    await LeadRepository(db).set_current_question(lead.id, first_question.id)
    await state.set_state(LeadStates.collecting)
    await state.update_data(
        lead_id=lead.id, service_id=service_id, question_id=first_question.id
    )

    intro_tpl = await texts.t(
        "service_intro", "Послуга: <b>{title}</b>\nВідповідайте на питання нижче."
    )
    await call.message.answer(intro_tpl.format(title=service.title))
    await ask_question(call.message, db, lead_id=lead.id, question_id=first_question.id)


@router.callback_query(F.data == "lead:back")
async def lead_back(call: CallbackQuery, db: AsyncSession, state: FSMContext) -> None:
    await call.answer()
    texts = Texts(db)
    if call.message is None:
        return
    if call.from_user is not None:
        try:
            u = await UserRepository(db).get_by_tg_id(call.from_user.id)
            if u is not None:
                await ChatRepository(db).mark_outbound_seen(user_id=u.id)
        except Exception:
            pass

    data = await state.get_data()
    lead_id = data.get("lead_id")
    if not isinstance(lead_id, int):
        await call.message.answer(
            await texts.t("session_lost", "Сесію втрачено. Натисніть /start.")
        )
        await state.clear()
        return

    leads = LeadRepository(db)
    last = await leads.get_last_answer(lead_id)
    if last is None:
        await call.message.answer(await texts.t("first_question", "Це перше питання."))
        return

    await leads.delete_answer(last.id)
    await leads.set_current_question(lead_id, last.question_id)
    await db.commit()

    await state.update_data(question_id=last.question_id)
    await ask_question(call.message, db, lead_id=lead_id, question_id=last.question_id)


@router.callback_query(F.data == "lead:cancel")
async def lead_cancel(call: CallbackQuery, db: AsyncSession, state: FSMContext) -> None:
    await call.answer()
    texts = Texts(db)
    if call.from_user is not None:
        try:
            u = await UserRepository(db).get_by_tg_id(call.from_user.id)
            if u is not None:
                await ChatRepository(db).mark_outbound_seen(user_id=u.id)
        except Exception:
            pass
    data = await state.get_data()
    lead_id = data.get("lead_id")
    if isinstance(lead_id, int):
        await LeadRepository(db).set_status(lead_id, LeadStatus.abandoned)
    await state.clear()
    if call.message:
        await call.message.answer(await texts.t("lead_cancelled", "Ок, скасовано."))
        await _send_services_menu(call.message, db)


@router.callback_query(F.data.startswith("opt:"))
async def option_selected(
    call: CallbackQuery, db: AsyncSession, state: FSMContext, bot: Bot
) -> None:
    await call.answer()
    texts = Texts(db)
    if call.message is None:
        return
    if call.from_user is not None:
        try:
            u = await UserRepository(db).get_by_tg_id(call.from_user.id)
            if u is not None:
                await ChatRepository(db).mark_outbound_seen(user_id=u.id)
        except Exception:
            pass
    if call.from_user is not None:
        u = await UserRepository(db).get_by_tg_id(call.from_user.id)
        if u is not None and bool(getattr(u, "support_enabled", False)):
            await call.message.answer(
                await texts.t("support_paused", DEFAULT_SUPPORT_PAUSED_TEXT)
            )
            return

    data = await state.get_data()
    lead_id = data.get("lead_id")
    service_id = data.get("service_id")
    question_id = data.get("question_id")
    if not all(isinstance(v, int) for v in [lead_id, service_id, question_id]):
        await call.message.answer(
            await texts.t("session_lost", "Сесію втрачено. Натисніть /start.")
        )
        await state.clear()
        return

    option_id = int(call.data.split(":", 1)[1])
    await LeadRepository(db).add_option_answer(
        lead_id=lead_id, question_id=question_id, option_id=option_id
    )

    status, nxt_id = await _resolve_next(
        db, service_id=service_id, question_id=question_id, option_id=option_id
    )
    if status == "finish":
        await _finish_lead(bot, db, lead_id=lead_id)
        await LeadRepository(db).set_current_question(lead_id, None)
        await texts.send(
            call.message,
            key="thanks",
            default="Дякуємо! Заявку прийнято.",
            allow_photo=True,
        )
        await state.clear()
        await _send_services_menu(call.message, db)
        return

    if status != "next" or nxt_id is None:
        await LeadRepository(db).set_status(lead_id, LeadStatus.abandoned)
        await LeadRepository(db).set_current_question(lead_id, None)
        await db.commit()
        await call.message.answer(
            await texts.t(
                "err_flow_not_configured",
                "Сценарій цієї послуги ще не налаштований (немає переходу або END). Оберіть іншу послугу.",
            )
        )
        await state.clear()
        await _send_services_menu(call.message, db)
        return

    await state.update_data(question_id=nxt_id)
    await LeadRepository(db).set_current_question(lead_id, nxt_id)
    await ask_question(call.message, db, lead_id=lead_id, question_id=nxt_id)


@router.message(LeadStates.collecting)
async def text_answer(
    message: Message, db: AsyncSession, state: FSMContext, bot: Bot
) -> None:
    texts = Texts(db)
    # If support is enabled, pause lead flow and treat messages as chat.
    if message.from_user is not None:
        u = await UserRepository(db).get_by_tg_id(message.from_user.id)
        if u is not None:
            try:
                if await UserRepository(db).auto_disable_support_if_expired(u):
                    await db.commit()
            except Exception:
                await db.rollback()

        if u is not None and bool(getattr(u, "support_enabled", False)):
            text = (message.text or message.caption or "").strip()
            if text:
                try:
                    await ChatRepository(db).mark_outbound_seen(user_id=u.id)
                except Exception:
                    pass
                await ChatRepository(db).add_inbound(
                    user_id=u.id,
                    text=text,
                    tg_message_id=message.message_id,
                    lead_id=None,
                )
                # notify admins (best-effort)
                try:
                    admin_ids = await AdminUserRepository(db).list_active_tg_ids()
                    for admin_tg_id in admin_ids:
                        try:
                            admin_tpl = await texts.t(
                                "admin_inbox_msg",
                                "Повідомлення від користувача {tg_id}:\n{text}",
                            )
                            await bot.send_message(
                                admin_tg_id,
                                admin_tpl.format(tg_id=u.tg_id, text=text),
                            )
                        except Exception:
                            continue
                except Exception:
                    pass
                await db.flush()
            await message.answer(
                await texts.t(
                    "msg_forwarded_to_manager", "Повідомлення передано менеджеру."
                )
            )
            return

    data = await state.get_data()
    lead_id = data.get("lead_id")
    service_id = data.get("service_id")
    question_id = data.get("question_id")
    if not all(isinstance(v, int) for v in [lead_id, service_id, question_id]):
        await message.answer(
            await texts.t("session_lost", "Сесію втрачено. Натисніть /start.")
        )
        await state.clear()
        return

    q = await QuestionRepository(db).get(question_id)
    if q is None:
        await message.answer(
            await texts.t(
                "err_load_question", "Не вдалося завантажити питання. Натисніть /start."
            )
        )
        await state.clear()
        return

    if q.qtype == QuestionType.single_choice:
        await message.answer(
            await texts.t(
                "err_choose_option", "Будь ласка, оберіть варіант кнопкою нижче."
            )
        )
        return

    value = (message.text or message.caption or "").strip()
    if not value and not message.photo and q.is_required:
        await message.answer(
            await texts.t(
                "err_answer_required",
                "Відповідь не може бути порожньою. Спробуйте ще раз.",
            )
        )
        return

    photo = message.photo[-1] if message.photo else None
    if photo is not None:
        rel = await _save_telegram_file_to_media(
            bot,
            file_id=photo.file_id,
            folder=f"lead_answers/{lead_id}/{question_id}",
            prefix=str(message.message_id),
        )
        await LeadRepository(db).add_photo_answer(
            lead_id=lead_id,
            question_id=question_id,
            photo_file_id=photo.file_id,
            photo_file_unique_id=getattr(photo, "file_unique_id", None),
            photo_path=rel,
            caption=value or None,
        )
    else:
        await LeadRepository(db).add_text_answer(
            lead_id=lead_id, question_id=question_id, text_value=value
        )

    status, nxt_id = await _resolve_next(
        db, service_id=service_id, question_id=question_id, option_id=None
    )
    if status == "finish":
        await _finish_lead(bot, db, lead_id=lead_id)
        await LeadRepository(db).set_current_question(lead_id, None)
        await texts.send(
            message, key="thanks", default="Дякуємо! Заявку прийнято.", allow_photo=True
        )
        await state.clear()
        await _send_services_menu(message, db)
        return

    if status != "next" or nxt_id is None:
        await LeadRepository(db).set_status(lead_id, LeadStatus.abandoned)
        await LeadRepository(db).set_current_question(lead_id, None)
        await db.commit()
        await message.answer(
            await texts.t(
                "err_flow_not_configured",
                "Сценарій цієї послуги ще не налаштований (немає переходу або END). Оберіть іншу послугу.",
            )
        )
        await state.clear()
        await _send_services_menu(message, db)
        return

    await state.update_data(question_id=nxt_id)
    await LeadRepository(db).set_current_question(lead_id, nxt_id)
    await ask_question(message, db, lead_id=lead_id, question_id=nxt_id)


@router.message(Command("back"), LeadStates.collecting)
async def lead_back_cmd(message: Message, db: AsyncSession, state: FSMContext) -> None:
    texts = Texts(db)
    data = await state.get_data()
    lead_id = data.get("lead_id")
    if not isinstance(lead_id, int):
        await message.answer(
            await texts.t("session_lost", "Сесію втрачено. Натисніть /start.")
        )
        await state.clear()
        return

    leads = LeadRepository(db)
    last = await leads.get_last_answer(lead_id)
    if last is None:
        await message.answer(await texts.t("first_question", "Це перше питання."))
        return

    await leads.delete_answer(last.id)
    await leads.set_current_question(lead_id, last.question_id)
    await db.commit()

    await state.update_data(question_id=last.question_id)
    await ask_question(message, db, lead_id=lead_id, question_id=last.question_id)
