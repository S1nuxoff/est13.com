from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from est13_core.db.base import Base
from est13_core.db.models.enums import QuestionType


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), index=True
    )

    code: Mapped[str] = mapped_column(String(64), default="")
    text: Mapped[str] = mapped_column(Text)
    qtype: Mapped[QuestionType] = mapped_column(
        sa.Enum(QuestionType, name="question_type"),
        default=QuestionType.text,
    )
    is_required: Mapped[bool] = mapped_column(default=True)
    sort: Mapped[int] = mapped_column(Integer, default=100)

    next_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id"), nullable=True
    )

    pos_x: Mapped[int] = mapped_column(Integer, default=0)
    pos_y: Mapped[int] = mapped_column(Integer, default=0)

    # Relative path under Settings.media_dir (e.g. "questions/abc.jpg").
    photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Explicit terminal marker: only ends the flow if True.
    ends_flow: Mapped[bool] = mapped_column(Boolean, default=False)
