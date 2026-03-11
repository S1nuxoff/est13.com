from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import Date, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.enums import LeadStatus
from est13_core.db.models.lead import Lead
from est13_core.db.models.service import Service
from est13_core.db.models.user import User

from ..deps import get_db, get_super_admin_ids, is_super_admin, require_admin, require_admin_token
from ..schemas.common import AdminShortOut
from ..schemas.dashboard import (
    DashboardDayItem,
    DashboardLeadItem,
    DashboardOut,
    DashboardServiceItem,
)


def register(app: FastAPI) -> None:
    @app.get("/api/dashboard", dependencies=[Depends(require_admin_token)])
    async def dashboard(
        db: Annotated[AsyncSession, Depends(get_db)],
        days: int = 30,
        admin: Annotated[AdminAccount | None, Depends(require_admin)] = None,
    ) -> DashboardOut:
        days = min(max(int(days), 1), 365)
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)

        super_admin_ids: set[int] = set()
        if not is_super_admin(admin):
            super_admin_ids = await get_super_admin_ids(db)

        def _admin_short(
            admin_id: int | None,
            admin_username: str | None,
            admin_display_name: str | None,
            admin_avatar_emoji: str | None,
        ) -> AdminShortOut | None:
            if admin_id is None:
                return None
            if int(admin_id) in super_admin_ids:
                return None
            return AdminShortOut(
                id=int(admin_id),
                username=str(admin_username),
                display_name=admin_display_name,
                avatar_emoji=admin_avatar_emoji,
            )

        total = await db.execute(select(func.count(Lead.id)))
        total_leads = int(total.scalar_one())

        by_status = await db.execute(
            select(Lead.status, func.count(Lead.id)).group_by(Lead.status)
        )
        status_map = {status.value: int(cnt) for status, cnt in by_status.all()}

        started_24h_row = await db.execute(
            select(func.count(Lead.id)).where(
                Lead.started_at >= (now - timedelta(days=1))
            )
        )
        started_24h = int(started_24h_row.scalar_one() or 0)
        submitted_24h_row = await db.execute(
            select(func.count(Lead.id))
            .where(Lead.submitted_at.is_not(None))
            .where(Lead.submitted_at >= (now - timedelta(days=1)))
        )
        submitted_24h = int(submitted_24h_row.scalar_one() or 0)

        started_7d_row = await db.execute(
            select(func.count(Lead.id)).where(
                Lead.started_at >= (now - timedelta(days=7))
            )
        )
        started_7d = int(started_7d_row.scalar_one() or 0)
        submitted_7d_row = await db.execute(
            select(func.count(Lead.id))
            .where(Lead.submitted_at.is_not(None))
            .where(Lead.submitted_at >= (now - timedelta(days=7)))
        )
        submitted_7d = int(submitted_7d_row.scalar_one() or 0)

        per_day_rows = await db.execute(
            select(
                func.cast(func.date_trunc("day", Lead.started_at), Date).label("day"),
                func.count(Lead.id),
            )
            .where(Lead.started_at >= cutoff)
            .group_by("day")
            .order_by("day")
        )
        per_day = [
            DashboardDayItem(day=str(day), total=int(cnt))
            for day, cnt in per_day_rows.all()
            if day is not None
        ]

        top_services_rows = await db.execute(
            select(Service.id, Service.title, func.count(Lead.id))
            .join(Lead, Lead.service_id == Service.id)
            .group_by(Service.id, Service.title)
            .order_by(func.count(Lead.id).desc())
            .limit(8)
        )
        top_services = [
            DashboardServiceItem(service_id=int(sid), title=title, total=int(cnt))
            for sid, title, cnt in top_services_rows.all()
        ]

        recent_rows = await db.execute(
            select(
                Lead.id,
                Service.title,
                Lead.status,
                User.tg_id,
                User.username,
                User.first_name,
                User.last_name,
                Lead.started_at,
                Lead.submitted_at,
                Lead.accepted_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .join(Service, Service.id == Lead.service_id)
            .join(User, User.id == Lead.user_id)
            .outerjoin(AdminAccount, AdminAccount.id == Lead.accepted_by_admin_id)
            .order_by(desc(Lead.id))
            .limit(12)
        )
        recent_leads = [
            DashboardLeadItem(
                id=int(lead_id),
                service_title=str(title),
                status=status.value,
                user_tg_id=int(tg_id),
                username=username,
                first_name=first_name,
                last_name=last_name,
                started_at=started_at,
                submitted_at=submitted_at,
                accepted_at=accepted_at,
                accepted_by_admin=_admin_short(
                    admin_id, admin_username, admin_display_name, admin_avatar_emoji
                ),
            )
            for (
                lead_id,
                title,
                status,
                tg_id,
                username,
                first_name,
                last_name,
                started_at,
                submitted_at,
                accepted_at,
                admin_id,
                admin_username,
                admin_display_name,
                admin_avatar_emoji,
            ) in recent_rows.all()
        ]

        work_statuses = (
            LeadStatus.in_review,
            LeadStatus.confirmed,
            LeadStatus.in_work,
            LeadStatus.paused,
        )
        work_rows = await db.execute(
            select(
                Lead.id,
                Service.title,
                Lead.status,
                User.tg_id,
                User.username,
                User.first_name,
                User.last_name,
                Lead.started_at,
                Lead.submitted_at,
                Lead.accepted_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .join(Service, Service.id == Lead.service_id)
            .join(User, User.id == Lead.user_id)
            .where(Lead.status.in_(work_statuses))
            .outerjoin(AdminAccount, AdminAccount.id == Lead.accepted_by_admin_id)
            .order_by(desc(Lead.id))
            .limit(12)
        )
        work_leads = [
            DashboardLeadItem(
                id=int(lead_id),
                service_title=str(title),
                status=status.value,
                user_tg_id=int(tg_id),
                username=username,
                first_name=first_name,
                last_name=last_name,
                started_at=started_at,
                submitted_at=submitted_at,
                accepted_at=accepted_at,
                accepted_by_admin=_admin_short(
                    admin_id, admin_username, admin_display_name, admin_avatar_emoji
                ),
            )
            for (
                lead_id,
                title,
                status,
                tg_id,
                username,
                first_name,
                last_name,
                started_at,
                submitted_at,
                accepted_at,
                admin_id,
                admin_username,
                admin_display_name,
                admin_avatar_emoji,
            ) in work_rows.all()
        ]

        unaccepted_count_row = await db.execute(
            select(func.count(Lead.id))
            .where(Lead.status == LeadStatus.awaiting_review)
            .where(Lead.submitted_at.is_not(None))
            .where(Lead.accepted_at.is_(None))
        )
        unaccepted = int(unaccepted_count_row.scalar_one() or 0)

        unaccepted_rows = await db.execute(
            select(
                Lead.id,
                Service.title,
                Lead.status,
                User.tg_id,
                User.username,
                User.first_name,
                User.last_name,
                Lead.started_at,
                Lead.submitted_at,
                Lead.accepted_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .join(Service, Service.id == Lead.service_id)
            .join(User, User.id == Lead.user_id)
            .outerjoin(AdminAccount, AdminAccount.id == Lead.accepted_by_admin_id)
            .where(Lead.status == LeadStatus.awaiting_review)
            .where(Lead.submitted_at.is_not(None))
            .where(Lead.accepted_at.is_(None))
            .order_by(desc(Lead.id))
            .limit(12)
        )
        unaccepted_leads = [
            DashboardLeadItem(
                id=int(lead_id),
                service_title=str(title),
                status=status.value,
                user_tg_id=int(tg_id),
                username=username,
                first_name=first_name,
                last_name=last_name,
                started_at=started_at,
                submitted_at=submitted_at,
                accepted_at=accepted_at,
                accepted_by_admin=_admin_short(
                    admin_id, admin_username, admin_display_name, admin_avatar_emoji
                ),
            )
            for (
                lead_id,
                title,
                status,
                tg_id,
                username,
                first_name,
                last_name,
                started_at,
                submitted_at,
                accepted_at,
                admin_id,
                admin_username,
                admin_display_name,
                admin_avatar_emoji,
            ) in unaccepted_rows.all()
        ]

        return DashboardOut(
            total_leads=total_leads,
            in_progress=status_map.get(LeadStatus.filling.value, 0),
            submitted=status_map.get(LeadStatus.awaiting_review.value, 0),
            cancelled=status_map.get(LeadStatus.abandoned.value, 0),
            review=status_map.get(LeadStatus.in_review.value, 0),
            contacted=status_map.get(LeadStatus.confirmed.value, 0),
            in_work=status_map.get(LeadStatus.in_work.value, 0),
            done=status_map.get(LeadStatus.done.value, 0),
            lost=status_map.get(LeadStatus.lost.value, 0),
            started_24h=started_24h,
            submitted_24h=submitted_24h,
            started_7d=started_7d,
            submitted_7d=submitted_7d,
            unaccepted=unaccepted,
            unaccepted_leads=unaccepted_leads,
            recent_leads=recent_leads,
            work_leads=work_leads,
            days=days,
            per_day=per_day,
            top_services=top_services,
        )
