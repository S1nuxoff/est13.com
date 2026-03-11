from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.enums import LeadSource, LeadStatus
from est13_core.db.models.lead import Lead
from est13_core.db.models.lead_answer import LeadAnswer
from est13_core.db.models.lead_event import LeadEvent
from est13_core.db.models.question import Question
from est13_core.db.models.question_option import QuestionOption
from est13_core.db.models.service import Service
from est13_core.db.models.user import User


class LeadRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self, *, user_id: int, service_id: int, source: LeadSource = LeadSource.bot
    ) -> Lead:
        lead = Lead(
            user_id=user_id,
            service_id=service_id,
            status=LeadStatus.filling,
            source=source,
        )
        self._session.add(lead)
        await self._session.flush()
        return lead

    async def get(self, lead_id: int) -> Lead | None:
        result = await self._session.execute(select(Lead).where(Lead.id == lead_id))
        return result.scalar_one_or_none()

    async def get_active_for_user(self, user_id: int) -> Lead | None:
        result = await self._session.execute(
            select(Lead)
            .where(Lead.user_id == user_id)
            .where(Lead.status == LeadStatus.filling)
            .order_by(desc(Lead.id))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def set_current_question(self, lead_id: int, question_id: int | None) -> None:
        lead = await self.get(lead_id)
        if lead is None:
            return
        lead.current_question_id = question_id

    async def set_status(
        self, lead_id: int, status: LeadStatus, *, admin_id: int | None = None
    ) -> None:
        lead = await self.get(lead_id)
        if lead is None:
            return
        prev = lead.status
        lead.status = status
        if prev != status:
            self._session.add(
                LeadEvent(
                    lead_id=int(lead.id),
                    from_status=prev,
                    to_status=status,
                    admin_id=int(admin_id) if admin_id is not None else None,
                )
            )
        if status == LeadStatus.awaiting_review:
            lead.submitted_at = datetime.utcnow()
            lead.current_question_id = None
        if status in (LeadStatus.abandoned,):
            lead.current_question_id = None

    async def add_text_answer(
        self, *, lead_id: int, question_id: int, text_value: str
    ) -> None:
        self._session.add(
            LeadAnswer(lead_id=lead_id, question_id=question_id, text_value=text_value)
        )

    async def add_option_answer(
        self, *, lead_id: int, question_id: int, option_id: int
    ) -> None:
        self._session.add(
            LeadAnswer(lead_id=lead_id, question_id=question_id, option_id=option_id)
        )

    async def add_photo_answer(
        self,
        *,
        lead_id: int,
        question_id: int,
        photo_file_id: str,
        photo_file_unique_id: str | None,
        photo_path: str | None,
        caption: str | None = None,
    ) -> None:
        self._session.add(
            LeadAnswer(
                lead_id=lead_id,
                question_id=question_id,
                text_value=caption,
                photo_file_id=photo_file_id,
                photo_file_unique_id=photo_file_unique_id,
                photo_path=photo_path,
            )
        )

    async def count_answers(self, lead_id: int) -> int:
        res = await self._session.execute(
            select(func.count(LeadAnswer.id)).where(LeadAnswer.lead_id == lead_id)
        )
        return int(res.scalar_one() or 0)

    async def get_last_answer(self, lead_id: int) -> LeadAnswer | None:
        res = await self._session.execute(
            select(LeadAnswer)
            .where(LeadAnswer.lead_id == lead_id)
            .order_by(desc(LeadAnswer.id))
            .limit(1)
        )
        return res.scalar_one_or_none()

    async def delete_answer(self, answer_id: int) -> None:
        await self._session.execute(
            delete(LeadAnswer).where(LeadAnswer.id == answer_id)
        )

    async def list_answers_for_summary(self, lead_id: int) -> list[tuple[str, str]]:
        stmt = (
            select(
                Question.text,
                LeadAnswer.text_value,
                LeadAnswer.photo_file_id,
                LeadAnswer.photo_path,
                QuestionOption.text,
            )
            .join(LeadAnswer, LeadAnswer.question_id == Question.id)
            .outerjoin(QuestionOption, LeadAnswer.option_id == QuestionOption.id)
            .where(LeadAnswer.lead_id == lead_id)
            .order_by(LeadAnswer.id)
        )
        result = await self._session.execute(stmt)
        rows: list[tuple[str, str]] = []
        for q_text, text_value, photo_file_id, photo_path, option_text in result.all():
            if option_text:
                answer_text = option_text
            elif photo_file_id or photo_path:
                answer_text = "PHOTO" + (f": {text_value}" if text_value else "")
            else:
                answer_text = text_value or ""
            rows.append((q_text, answer_text))
        return rows

    async def list_recent(self, limit: int = 10) -> list[
        tuple[
            int,
            str,
            int,
            int,
            str | None,
            str | None,
            str | None,
            str | None,
            datetime,
            datetime | None,
            LeadStatus,
        ]
    ]:
        stmt = (
            select(
                Lead.id,
                Service.title,
                User.id,
                User.tg_id,
                User.username,
                User.first_name,
                User.last_name,
                getattr(User, "photo_file_id", None),
                Lead.started_at,
                Lead.submitted_at,
                Lead.status,
            )
            .join(Service, Service.id == Lead.service_id)
            .join(User, User.id == Lead.user_id)
            .order_by(desc(Lead.id))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        out = []
        for row in result.all():
            (
                lead_id,
                title,
                user_id,
                tg_id,
                username,
                first_name,
                last_name,
                photo_file_id,
                started_at,
                submitted_at,
                status,
            ) = row
            out.append(
                (
                    int(lead_id),
                    str(title),
                    int(user_id),
                    int(tg_id),
                    username,
                    first_name,
                    last_name,
                    photo_file_id,
                    started_at,
                    submitted_at,
                    status,
                )
            )
        return out

    async def list_for_user(
        self, *, user_id: int, limit: int = 10
    ) -> list[tuple[int, str, LeadStatus, datetime, datetime | None, datetime | None]]:
        stmt = (
            select(
                Lead.id,
                Service.title,
                Lead.status,
                Lead.started_at,
                Lead.submitted_at,
                getattr(Lead, "accepted_at", None),
            )
            .join(Service, Service.id == Lead.service_id)
            .where(Lead.user_id == int(user_id))
            .order_by(desc(Lead.id))
            .limit(min(max(int(limit), 1), 100))
        )
        res = await self._session.execute(stmt)
        out: list[
            tuple[int, str, LeadStatus, datetime, datetime | None, datetime | None]
        ] = []
        for lead_id, title, status, started_at, submitted_at, accepted_at in res.all():
            out.append(
                (
                    int(lead_id),
                    str(title),
                    status,
                    started_at,
                    submitted_at,
                    accepted_at,
                )
            )
        return out
