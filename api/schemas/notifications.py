from __future__ import annotations

from pydantic import BaseModel


class NotificationsOut(BaseModel):
    unread_total: int
    unread_outside_brief: int
    unaccepted_leads: int = 0

