from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .common import AdminShortOut


class DashboardServiceItem(BaseModel):
    service_id: int
    title: str
    total: int


class DashboardDayItem(BaseModel):
    day: str
    total: int


class DashboardLeadItem(BaseModel):
    id: int
    service_title: str
    status: str
    user_tg_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    started_at: datetime
    submitted_at: datetime | None = None
    accepted_at: datetime | None = None
    accepted_by_admin: AdminShortOut | None = None


class DashboardOut(BaseModel):
    total_leads: int
    in_progress: int
    submitted: int
    cancelled: int
    review: int = 0
    contacted: int = 0
    in_work: int = 0
    done: int = 0
    lost: int = 0
    started_24h: int = 0
    submitted_24h: int = 0
    started_7d: int = 0
    submitted_7d: int = 0
    unaccepted: int = 0
    unaccepted_leads: list[DashboardLeadItem] = []
    recent_leads: list[DashboardLeadItem] = []
    work_leads: list[DashboardLeadItem] = []
    days: int
    per_day: list[DashboardDayItem]
    top_services: list[DashboardServiceItem]

