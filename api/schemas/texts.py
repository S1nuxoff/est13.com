from __future__ import annotations

from pydantic import BaseModel


class BotTextOut(BaseModel):
    key: str
    value: str
    photo_path: str | None = None


class BotTextCreate(BaseModel):
    key: str
    value: str


class BotTextIn(BaseModel):
    value: str

