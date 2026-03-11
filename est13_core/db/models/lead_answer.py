from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from est13_core.db.base import Base


class LeadAnswer(Base):
    __tablename__ = "lead_answers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), index=True
    )

    option_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_options.id", ondelete="SET NULL"), nullable=True
    )
    text_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # For photo answers (Telegram): store both file_id and a local copy (best-effort).
    photo_file_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    photo_file_unique_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # Relative path under Settings.media_dir (e.g. "lead_answers/123/456/photo.jpg").
    photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
