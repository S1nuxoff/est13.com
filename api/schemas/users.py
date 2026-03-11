from __future__ import annotations

from pydantic import BaseModel

from .common import AdminShortOut


class UserOut(BaseModel):
    id: int
    tg_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    language_code: str | None
    support_enabled: bool
    support_enabled_until: str | None = None
    support_admin: AdminShortOut | None = None
    photo_file_id: str | None
    active_lead_id: int | None = None
    active_service_title: str | None = None
    active_question_text: str | None = None
    updated_at: str | None
    unread_count: int = 0


class UserListOut(BaseModel):
    items: list[UserOut]


class UserPatch(BaseModel):
    support_enabled: bool | None = None


class ChatMessageOut(BaseModel):
    id: int
    direction: str
    text: str
    tg_message_id: int | None
    admin_tg_id: int | None
    admin_id: int | None = None
    admin: AdminShortOut | None = None
    created_at: str
    seen_at: str | None = None
    admin_seen_at: str | None = None


class ChatMessagesOut(BaseModel):
    items: list[ChatMessageOut]


class SendMessageIn(BaseModel):
    text: str

