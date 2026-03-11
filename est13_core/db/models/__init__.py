"""
Import all models so SQLAlchemy registers every Table in Base.metadata.

This is important because some models reference others via ForeignKey(...) and
SQLAlchemy may need the target tables present in the same MetaData.
"""

# ruff: noqa: F401

from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.admin_session import AdminSession
from est13_core.db.models.admin_user import AdminUser
from est13_core.db.models.bot_text import BotText
from est13_core.db.models.chat_message import ChatMessage
from est13_core.db.models.lead import Lead
from est13_core.db.models.lead_answer import LeadAnswer
from est13_core.db.models.lead_event import LeadEvent
from est13_core.db.models.project import Project
from est13_core.db.models.project_file import ProjectFile
from est13_core.db.models.project_note import ProjectNote
from est13_core.db.models.question import Question
from est13_core.db.models.question_option import QuestionOption
from est13_core.db.models.service import Service
from est13_core.db.models.user import User
