from __future__ import annotations

from pydantic import BaseModel


class LeadStatusPatch(BaseModel):
    status: str

