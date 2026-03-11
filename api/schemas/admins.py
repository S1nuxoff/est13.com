from __future__ import annotations

from pydantic import BaseModel

from .common import AdminShortOut


class AppSettingsOut(BaseModel):
    support_auto_disable_minutes: int


class AppSettingsPatchIn(BaseModel):
    support_auto_disable_minutes: int | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class AdminMeOut(BaseModel):
    id: int
    username: str
    display_name: str | None
    avatar_emoji: str | None = None
    is_super: bool = False


class LoginOut(BaseModel):
    token: str
    admin: AdminMeOut


class AdminAccountOut(BaseModel):
    id: int
    username: str
    display_name: str | None
    avatar_emoji: str | None
    is_super: bool
    is_active: bool
    created_at: str
    last_login_at: str | None


class AdminAccountCreateIn(BaseModel):
    username: str
    display_name: str | None = None
    avatar_emoji: str | None = None
    password: str
    is_super: bool | None = None


class AdminAccountPatchIn(BaseModel):
    display_name: str | None = None
    avatar_emoji: str | None = None
    is_active: bool | None = None
    is_super: bool | None = None
    old_password: str | None = None
    new_password: str | None = None
