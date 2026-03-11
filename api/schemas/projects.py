from __future__ import annotations

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    lead_id: int
    title: str | None = None
    description: str | None = None


class ProjectPatch(BaseModel):
    title: str | None = None
    description: str | None = None


class ProjectNoteCreate(BaseModel):
    body: str


class ProjectNotePatch(BaseModel):
    body: str | None = None

