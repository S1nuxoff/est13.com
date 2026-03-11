from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import BigInteger, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from est13_core.db.base import Base
from est13_core.db.models.enums import AdminRole


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    role: Mapped[AdminRole] = mapped_column(
        sa.Enum(AdminRole, name="admin_role"),
        default=AdminRole.admin,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
