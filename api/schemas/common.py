from __future__ import annotations

from pydantic import BaseModel


class AdminShortOut(BaseModel):
    id: int
    username: str
    display_name: str | None
    avatar_emoji: str | None = None

