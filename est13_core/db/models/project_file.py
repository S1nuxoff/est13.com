from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from est13_core.db.base import Base


class ProjectFile(Base):
    __tablename__ = "project_files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )

    filename: Mapped[str] = mapped_column(Text, default="")
    mime_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Relative path under Settings.media_dir (e.g. "projects/12/abc.pdf").
    path: Mapped[str] = mapped_column(Text, default="")

    created_by_admin_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
