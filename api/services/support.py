from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.config import get_settings
from est13_core.db.models.bot_text import BotText
from est13_core.db.models.user import User
from est13_core.db.repositories.bot_text import BotTextRepository


async def get_support_auto_disable_minutes(db: AsyncSession) -> int:
    default = int(get_settings().support_auto_disable_minutes or 180)
    try:
        raw = await BotTextRepository(db).get("support_auto_disable_minutes")
        if raw is None:
            return default
        v = int(str(raw).strip())
        if v <= 0:
            return default
        return v
    except Exception:
        return default


async def support_expires_at(db: AsyncSession) -> datetime:
    minutes = await get_support_auto_disable_minutes(db)
    minutes = min(max(int(minutes), 1), 60 * 24 * 7)
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


async def auto_disable_expired_support(db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    expires_at = await support_expires_at(db)

    backfill = (
        update(User)
        .where(User.support_enabled.is_(True))
        .where(User.support_enabled_until.is_(None))
        .values(
            support_enabled_at=func.coalesce(User.support_enabled_at, now),
            support_enabled_until=expires_at,
            updated_at=datetime.utcnow(),
        )
    )
    backfill_res = await db.execute(backfill)

    stmt = (
        update(User)
        .where(User.support_enabled.is_(True))
        .where(User.support_enabled_until.is_not(None))
        .where(User.support_enabled_until <= now)
        .values(
            support_enabled=False,
            support_enabled_at=None,
            support_enabled_until=None,
            support_admin_id=None,
            updated_at=datetime.utcnow(),
        )
    )
    res = await db.execute(stmt)
    if (backfill_res.rowcount or 0) > 0 or (res.rowcount or 0) > 0:
        await db.commit()
    return int(res.rowcount or 0)
