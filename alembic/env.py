from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from est13_core.config import get_settings
from est13_core.db.base import Base
from est13_core.db.models.user import User  # noqa: F401
from est13_core.db.models.admin_user import AdminUser  # noqa: F401
from est13_core.db.models.bot_text import BotText  # noqa: F401
from est13_core.db.models.lead import Lead  # noqa: F401
from est13_core.db.models.lead_answer import LeadAnswer  # noqa: F401
from est13_core.db.models.service import Service  # noqa: F401
from est13_core.db.models.question import Question  # noqa: F401
from est13_core.db.models.question_option import QuestionOption  # noqa: F401
from est13_core.db.models.chat_message import ChatMessage  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    settings = get_settings()
    return settings.database_url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    config_section = config.get_section(config.config_ini_section, {})
    config_section["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        config_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
