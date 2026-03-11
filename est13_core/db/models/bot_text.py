from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from est13_core.db.base import Base


class BotText(Base):
    __tablename__ = "bot_texts"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    # Relative path under Settings.media_dir (e.g. "texts/greeting/abc.jpg").
    photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
