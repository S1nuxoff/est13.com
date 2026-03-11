from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from est13_core.db.base import Base


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )

    text: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(64), default="")
    sort: Mapped[int] = mapped_column(Integer, default=100)

    # Inline keyboard placement (Telegram). Options with same row appear on the same line.
    keyboard_row: Mapped[int] = mapped_column(Integer, default=0)
    keyboard_col: Mapped[int] = mapped_column(Integer, default=0)

    next_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id"), nullable=True
    )

    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Explicit terminal marker: only ends the flow if True.
    ends_flow: Mapped[bool] = mapped_column(Boolean, default=False)
