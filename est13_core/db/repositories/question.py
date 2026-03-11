from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.question import Question
from est13_core.db.models.question_option import QuestionOption


class QuestionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get(
        self, question_id: int, *, include_archived: bool = False
    ) -> Question | None:
        stmt = select(Question).where(Question.id == question_id)
        if not include_archived:
            stmt = stmt.where(Question.is_archived.is_(False))
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_service(
        self, service_id: int, *, include_archived: bool = False
    ) -> list[Question]:
        stmt = select(Question).where(Question.service_id == service_id)
        if not include_archived:
            stmt = stmt.where(Question.is_archived.is_(False))
        stmt = stmt.order_by(Question.sort, Question.id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_first_for_service(
        self, service_id: int, *, include_archived: bool = False
    ) -> Question | None:
        stmt = select(Question).where(Question.service_id == service_id)
        if not include_archived:
            stmt = stmt.where(Question.is_archived.is_(False))
        stmt = stmt.order_by(Question.sort, Question.id).limit(1)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_by_sort(
        self, service_id: int, current_question_id: int
    ) -> Question | None:
        current = await self.get(current_question_id)
        if current is None:
            return None
        result = await self._session.execute(
            select(Question)
            .where(Question.service_id == service_id)
            .where(Question.is_archived.is_(False))
            .where(Question.sort > current.sort)
            .order_by(Question.sort, Question.id)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_options(
        self, question_id: int, *, include_archived: bool = False
    ) -> list[QuestionOption]:
        stmt = select(QuestionOption).where(QuestionOption.question_id == question_id)
        if not include_archived:
            stmt = stmt.where(QuestionOption.is_archived.is_(False))
        stmt = stmt.order_by(
            QuestionOption.keyboard_row,
            QuestionOption.keyboard_col,
            QuestionOption.sort,
            QuestionOption.id,
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_options_for_questions(
        self, question_ids: list[int], *, include_archived: bool = False
    ) -> list[QuestionOption]:
        if not question_ids:
            return []
        stmt = select(QuestionOption).where(
            QuestionOption.question_id.in_(list(map(int, question_ids)))
        )
        if not include_archived:
            stmt = stmt.where(QuestionOption.is_archived.is_(False))
        stmt = stmt.order_by(
            QuestionOption.question_id,
            QuestionOption.keyboard_row,
            QuestionOption.keyboard_col,
            QuestionOption.sort,
            QuestionOption.id,
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_option(self, option_id: int) -> QuestionOption | None:
        result = await self._session.execute(
            select(QuestionOption).where(QuestionOption.id == option_id)
        )
        return result.scalar_one_or_none()
