from __future__ import annotations

import mimetypes
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.enums import LeadSource, LeadStatus, QuestionType
from est13_core.db.models.lead import Lead
from est13_core.db.models.lead_answer import LeadAnswer
from est13_core.db.models.lead_event import LeadEvent
from est13_core.db.models.question import Question
from est13_core.db.models.question_option import QuestionOption
from est13_core.db.models.service import Service
from est13_core.db.models.user import User
from est13_core.db.repositories.lead import LeadRepository
from est13_core.db.repositories.question import QuestionRepository
from est13_core.db.repositories.service import ServiceRepository

from ..deps import get_db, require_webapp_user
from ..services.media import media_root, save_upload_image
from ..services.bot import fetch_telegram_file_bytes


class WebAppServiceOut(BaseModel):
    id: int
    title: str


class WebAppOptionOut(BaseModel):
    id: int
    text: str
    keyboard_row: int
    keyboard_col: int


class WebAppQuestionOut(BaseModel):
    id: int
    text: str
    qtype: str
    is_required: bool
    photo: bool
    options: list[WebAppOptionOut] = []


class WebAppAnswerOut(BaseModel):
    id: int
    question_id: int
    question_text: str
    value: str
    has_photo: bool


class WebAppStateOut(BaseModel):
    active: bool
    lead_id: int | None = None
    service_id: int | None = None
    service_title: str | None = None
    step: int | None = None
    total: int | None = None
    question: WebAppQuestionOut | None = None
    answers: list[WebAppAnswerOut] = []


class WebAppStartIn(BaseModel):
    service_id: int


class WebAppRewindIn(BaseModel):
    answer_id: int


class WebAppMyLeadItemOut(BaseModel):
    id: int
    service_id: int
    service_title: str | None = None
    status: str
    started_at: str | None = None
    submitted_at: str | None = None
    updated_at: str | None = None


class WebAppMyLeadDetailsOut(BaseModel):
    id: int
    service_id: int
    service_title: str | None = None
    status: str
    started_at: str | None = None
    submitted_at: str | None = None
    updated_at: str | None = None
    answers: list[WebAppAnswerOut] = []
    events: list[dict] = []


async def _webapp_service_is_ready(db: AsyncSession, *, service: Service) -> bool:
    start_qid = getattr(service, "start_question_id", None)
    if not isinstance(start_qid, int):
        return False

    qrepo = QuestionRepository(db)
    questions = await qrepo.list_for_service(service.id)
    if not questions:
        return False
    by_id = {q.id: q for q in questions}
    if start_qid not in by_id:
        return False

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
            opts = await qrepo.list_options(q.id)
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


async def _webapp_build_state(db: AsyncSession, *, user: User) -> WebAppStateOut:
    leads = LeadRepository(db)
    qrepo = QuestionRepository(db)
    lead = await leads.get_active_for_user(user.id)
    if lead is None or not isinstance(getattr(lead, "current_question_id", None), int):
        return WebAppStateOut(active=False)

    service = await db.get(Service, lead.service_id)
    qid = int(getattr(lead, "current_question_id"))
    q = await qrepo.get(qid, include_archived=True)
    if q is None:
        return WebAppStateOut(active=False)

    ans_rows = await db.execute(
        select(
            LeadAnswer.id,
            LeadAnswer.question_id,
            Question.text,
            LeadAnswer.text_value,
            LeadAnswer.photo_file_id,
            LeadAnswer.photo_path,
            QuestionOption.text,
        )
        .join(Question, Question.id == LeadAnswer.question_id)
        .outerjoin(QuestionOption, LeadAnswer.option_id == QuestionOption.id)
        .where(LeadAnswer.lead_id == lead.id)
        .order_by(LeadAnswer.id)
    )
    answers: list[WebAppAnswerOut] = []
    for (
        ans_id,
        q_id,
        q_text,
        text_value,
        photo_file_id,
        photo_path,
        opt_text,
    ) in ans_rows.all():
        if opt_text:
            v = opt_text
        elif photo_file_id or photo_path:
            v = "Фото" + (f": {text_value}" if text_value else "")
        else:
            v = text_value or ""
        answers.append(
            WebAppAnswerOut(
                id=int(ans_id),
                question_id=int(q_id),
                question_text=str(q_text or ""),
                value=v,
                has_photo=bool(photo_file_id or photo_path),
            )
        )

    answered = await leads.count_answers(lead.id)
    total = len(await qrepo.list_for_service(q.service_id))
    step = answered + 1

    opts: list[WebAppOptionOut] = []
    if q.qtype == QuestionType.single_choice:
        for o in await qrepo.list_options(q.id):
            opts.append(
                WebAppOptionOut(
                    id=o.id,
                    text=o.text,
                    keyboard_row=getattr(o, "keyboard_row", 0),
                    keyboard_col=getattr(o, "keyboard_col", 0),
                )
            )

    return WebAppStateOut(
        active=True,
        lead_id=lead.id,
        service_id=lead.service_id,
        service_title=service.title if service else None,
        step=step,
        total=total,
        question=WebAppQuestionOut(
            id=q.id,
            text=q.text,
            qtype=q.qtype.value,
            is_required=bool(q.is_required),
            photo=bool(getattr(q, "photo_path", None)),
            options=opts,
        ),
        answers=answers,
    )


async def _webapp_resolve_next(
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


def register(app: FastAPI) -> None:
    @app.get("/api/webapp/services")
    async def webapp_services(
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> list[WebAppServiceOut]:
        services_list = await ServiceRepository(db).list_active()
        out: list[WebAppServiceOut] = []
        for s in services_list:
            if await _webapp_service_is_ready(db, service=s):
                out.append(WebAppServiceOut(id=s.id, title=s.title))
        return out

    @app.get("/api/webapp/state")
    async def webapp_state(
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> WebAppStateOut:
        return await _webapp_build_state(db, user=user)

    @app.post("/api/webapp/start")
    async def webapp_start(
        payload: WebAppStartIn,
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> WebAppStateOut:
        leads = LeadRepository(db)
        active = await leads.get_active_for_user(user.id)
        if active is not None and isinstance(
            getattr(active, "current_question_id", None), int
        ):
            return await _webapp_build_state(db, user=user)

        service = await db.get(Service, payload.service_id)
        if service is None or not service.is_active:
            raise HTTPException(status_code=404, detail="Service not found")
        if not await _webapp_service_is_ready(db, service=service):
            raise HTTPException(status_code=400, detail="Service is not configured")

        start_qid = getattr(service, "start_question_id", None)
        if not isinstance(start_qid, int):
            raise HTTPException(status_code=400, detail="Service has no start question")
        q0 = await QuestionRepository(db).get(start_qid)
        if q0 is None or q0.service_id != service.id:
            raise HTTPException(status_code=400, detail="Invalid start question")

        lead = await leads.create(
            user_id=user.id, service_id=service.id, source=LeadSource.webapp
        )
        await leads.set_current_question(lead.id, q0.id)
        await db.commit()
        return await _webapp_build_state(db, user=user)

    @app.post("/api/webapp/answer")
    async def webapp_answer(
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
        option_id: int | None = Form(default=None),
        text: str | None = Form(default=None),
        file: UploadFile | None = File(default=None),
    ) -> WebAppStateOut:
        leads = LeadRepository(db)
        qrepo = QuestionRepository(db)

        lead = await leads.get_active_for_user(user.id)
        if lead is None or not isinstance(
            getattr(lead, "current_question_id", None), int
        ):
            raise HTTPException(status_code=400, detail="No active lead")

        qid = int(getattr(lead, "current_question_id"))
        q = await qrepo.get(qid, include_archived=True)
        if q is None:
            raise HTTPException(status_code=400, detail="Invalid question")

        if q.qtype == QuestionType.single_choice:
            if not option_id:
                raise HTTPException(status_code=400, detail="Option is required")
            await leads.add_option_answer(
                lead_id=lead.id, question_id=q.id, option_id=int(option_id)
            )
        else:
            text_value = (text or "").strip()
            if not text_value and file is None and bool(q.is_required):
                raise HTTPException(status_code=400, detail="Answer is required")

            if file is not None:
                rel = await save_upload_image(
                    file,
                    folder=f"lead_answers/{lead.id}/{q.id}",
                    prefix="web",
                )
                await leads.add_photo_answer(
                    lead_id=lead.id,
                    question_id=q.id,
                    photo_file_id="webapp",
                    photo_file_unique_id=None,
                    photo_path=rel,
                    caption=text_value or None,
                )
            else:
                await leads.add_text_answer(
                    lead_id=lead.id, question_id=q.id, text_value=text_value
                )

        status, nxt_id = await _webapp_resolve_next(
            db, service_id=lead.service_id, question_id=q.id, option_id=option_id
        )
        if status == "finish":
            await leads.set_status(lead.id, LeadStatus.awaiting_review)
            await leads.set_current_question(lead.id, None)
            await db.commit()
            return WebAppStateOut(active=False)
        if status != "next" or nxt_id is None:
            await leads.set_status(lead.id, LeadStatus.abandoned)
            await leads.set_current_question(lead.id, None)
            await db.commit()
            raise HTTPException(status_code=400, detail="Flow is not configured")

        await leads.set_current_question(lead.id, nxt_id)
        await db.commit()
        return await _webapp_build_state(db, user=user)

    @app.post("/api/webapp/back")
    async def webapp_back(
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> WebAppStateOut:
        leads = LeadRepository(db)
        lead = await leads.get_active_for_user(user.id)
        if lead is None:
            return WebAppStateOut(active=False)
        last = await leads.get_last_answer(lead.id)
        if last is None:
            return await _webapp_build_state(db, user=user)
        await leads.delete_answer(last.id)
        await leads.set_current_question(lead.id, last.question_id)
        await db.commit()
        return await _webapp_build_state(db, user=user)

    @app.post("/api/webapp/rewind")
    async def webapp_rewind(
        payload: WebAppRewindIn,
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> WebAppStateOut:
        leads = LeadRepository(db)
        lead = await leads.get_active_for_user(user.id)
        if lead is None:
            raise HTTPException(status_code=400, detail="No active lead")

        res = await db.execute(
            select(LeadAnswer)
            .where(LeadAnswer.id == payload.answer_id)
            .where(LeadAnswer.lead_id == lead.id)
        )
        ans = res.scalar_one_or_none()
        if ans is None:
            raise HTTPException(status_code=404, detail="Answer not found")

        await db.execute(
            delete(LeadAnswer)
            .where(LeadAnswer.lead_id == lead.id)
            .where(LeadAnswer.id >= ans.id)
        )
        await leads.set_current_question(lead.id, ans.question_id)
        await db.commit()
        return await _webapp_build_state(db, user=user)

    @app.get("/api/webapp/questions/{question_id}/photo")
    async def webapp_question_photo(
        question_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> Response:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found")
        rel = getattr(q, "photo_path", None)
        if not rel:
            raise HTTPException(status_code=404, detail="No photo")
        abs_path = media_root() / str(rel)
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail="No photo")
        content = abs_path.read_bytes()
        media_type = mimetypes.guess_type(str(abs_path))[0] or "image/jpeg"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )

    @app.get("/api/webapp/lead_answers/{answer_id}/photo")
    async def webapp_lead_answer_photo(
        answer_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> Response:
        ans = await db.get(LeadAnswer, answer_id)
        if ans is None:
            raise HTTPException(status_code=404, detail="Not found")
        lead = await db.get(Lead, ans.lead_id)
        if lead is None or lead.user_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        rel = getattr(ans, "photo_path", None)
        if rel:
            abs_path = media_root() / str(rel)
            if abs_path.exists():
                content = abs_path.read_bytes()
                media_type = mimetypes.guess_type(str(abs_path))[0] or "image/jpeg"
                return Response(
                    content=content,
                    media_type=media_type,
                    headers={"Cache-Control": "private, max-age=300"},
                )

        file_id = getattr(ans, "photo_file_id", None)
        if file_id:
            content, media_type = await fetch_telegram_file_bytes(str(file_id))
            return Response(
                content=content,
                media_type=media_type,
                headers={"Cache-Control": "private, max-age=300"},
            )

        raise HTTPException(status_code=404, detail="No photo")

    @app.get("/api/webapp/my/leads")
    async def webapp_my_leads(
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
        limit: int = 50,
    ) -> list[WebAppMyLeadItemOut]:
        limit = min(max(int(limit), 1), 200)
        updated_at_expr = func.coalesce(Lead.submitted_at, Lead.started_at).label(
            "updated_at"
        )
        rows = await db.execute(
            select(
                Lead.id,
                Lead.service_id,
                Service.title,
                Lead.status,
                Lead.started_at,
                Lead.submitted_at,
                updated_at_expr,
            )
            .join(Service, Service.id == Lead.service_id)
            .where(Lead.user_id == int(user.id))
            .order_by(Lead.id.desc())
            .limit(limit)
        )
        out: list[WebAppMyLeadItemOut] = []
        for (
            lead_id,
            service_id,
            service_title,
            status,
            started_at,
            submitted_at,
            updated_at,
        ) in rows.all():
            out.append(
                WebAppMyLeadItemOut(
                    id=int(lead_id),
                    service_id=int(service_id),
                    service_title=(
                        str(service_title) if service_title is not None else None
                    ),
                    status=status.value if hasattr(status, "value") else str(status),
                    started_at=started_at.isoformat() if started_at else None,
                    submitted_at=submitted_at.isoformat() if submitted_at else None,
                    updated_at=updated_at.isoformat() if updated_at else None,
                )
            )
        return out

    @app.get("/api/webapp/my/leads/{lead_id}")
    async def webapp_my_lead_details(
        lead_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        user: Annotated[User, Depends(require_webapp_user)],
    ) -> WebAppMyLeadDetailsOut:
        lead = await db.get(Lead, int(lead_id))
        if lead is None or int(lead.user_id) != int(user.id):
            raise HTTPException(status_code=404, detail="Not found")

        service = await db.get(Service, int(lead.service_id))

        ans_rows = await db.execute(
            select(
                LeadAnswer.id,
                LeadAnswer.question_id,
                Question.text,
                LeadAnswer.text_value,
                LeadAnswer.photo_file_id,
                LeadAnswer.photo_path,
                QuestionOption.text,
            )
            .join(Question, Question.id == LeadAnswer.question_id)
            .outerjoin(QuestionOption, QuestionOption.id == LeadAnswer.option_id)
            .where(LeadAnswer.lead_id == int(lead_id))
            .order_by(LeadAnswer.id.asc())
        )
        answers: list[WebAppAnswerOut] = []
        for (
            ans_id,
            q_id,
            q_text,
            text_value,
            photo_file_id,
            photo_path,
            opt_text,
        ) in ans_rows.all():
            if opt_text:
                v = opt_text
            elif photo_file_id or photo_path:
                v = "Фото" + (f": {text_value}" if text_value else "")
            else:
                v = text_value or ""
            answers.append(
                WebAppAnswerOut(
                    id=int(ans_id),
                    question_id=int(q_id),
                    question_text=str(q_text or ""),
                    value=v,
                    has_photo=bool(photo_file_id or photo_path),
                )
            )

        ev_rows = await db.execute(
            select(LeadEvent.id, LeadEvent.to_status, LeadEvent.created_at)
            .where(LeadEvent.lead_id == int(lead_id))
            .order_by(LeadEvent.created_at.asc(), LeadEvent.id.asc())
        )
        events = [
            {
                "id": int(eid),
                "to_status": s.value if s is not None else None,
                "created_at": created_at.isoformat() if created_at else None,
            }
            for eid, s, created_at in ev_rows.all()
        ]

        updated_at = lead.submitted_at or lead.started_at
        return WebAppMyLeadDetailsOut(
            id=int(lead.id),
            service_id=int(lead.service_id),
            service_title=service.title if service else None,
            status=lead.status.value,
            started_at=lead.started_at.isoformat() if lead.started_at else None,
            submitted_at=lead.submitted_at.isoformat() if lead.submitted_at else None,
            updated_at=updated_at.isoformat() if updated_at else None,
            answers=answers,
            events=events,
        )
