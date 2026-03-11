from __future__ import annotations

from pydantic import BaseModel


class BroadcastIn(BaseModel):
    text: str
    only_support_enabled: bool = False
    support_enabled: bool | None = None
    has_active_lead: bool | None = None
    last_lead_statuses: list[str] | None = None
    service_ids: list[int] | None = None
    language_codes: list[str] | None = None
    last_active_days: int | None = None
    tg_ids: list[int] | None = None
    photo_path: str | None = None


class BroadcastOut(BaseModel):
    ok: bool
    total: int
    sent: int
    failed: int


class BroadcastEstimateOut(BaseModel):
    total: int


class BroadcastPhotoOut(BaseModel):
    photo_path: str

