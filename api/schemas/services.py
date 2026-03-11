from __future__ import annotations

from pydantic import BaseModel


class ServiceOut(BaseModel):
    id: int
    slug: str
    title: str
    is_active: bool
    sort: int
    start_question_id: int | None = None


class ServiceIn(BaseModel):
    slug: str
    title: str
    is_active: bool = True
    sort: int = 100
    start_question_id: int | None = None


class ServicePatch(BaseModel):
    title: str | None = None
    is_active: bool | None = None
    sort: int | None = None
    start_question_id: int | None = None


class BotTextOut(BaseModel):
    key: str
    value: str
    photo_path: str | None = None


class QuestionOptionOut(BaseModel):
    id: int
    question_id: int
    text: str
    value: str
    sort: int
    keyboard_row: int
    keyboard_col: int
    next_question_id: int | None
    ends_flow: bool
    is_archived: bool


class QuestionOut(BaseModel):
    id: int
    service_id: int
    code: str
    text: str
    qtype: str
    is_required: bool
    sort: int
    next_question_id: int | None
    ends_flow: bool
    pos_x: int
    pos_y: int
    photo_path: str | None = None
    is_archived: bool
    options: list[QuestionOptionOut] = []


class QuestionCreate(BaseModel):
    code: str = ""
    text: str
    qtype: str = "text"
    is_required: bool = True
    sort: int = 100
    next_question_id: int | None = None
    pos_x: int = 0
    pos_y: int = 0


class QuestionPatch(BaseModel):
    code: str | None = None
    text: str | None = None
    qtype: str | None = None
    is_required: bool | None = None
    sort: int | None = None
    next_question_id: int | None = None
    ends_flow: bool | None = None
    pos_x: int | None = None
    pos_y: int | None = None
    is_archived: bool | None = None


class OptionCreate(BaseModel):
    text: str
    value: str = ""
    sort: int = 100
    keyboard_row: int = 0
    keyboard_col: int = 0
    next_question_id: int | None = None
    ends_flow: bool = False


class OptionPatch(BaseModel):
    text: str | None = None
    value: str | None = None
    sort: int | None = None
    keyboard_row: int | None = None
    keyboard_col: int | None = None
    next_question_id: int | None = None
    ends_flow: bool | None = None

