from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


def create_engine_and_sessionmaker(database_url: str) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(database_url, pool_pre_ping=True)
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    return engine, sessionmaker


async def ensure_sqlite_data_dir(database_url: str) -> None:
    parsed = urlparse(database_url)
    if parsed.scheme not in {"sqlite+aiosqlite", "sqlite"}:
        return

    path = (parsed.path or "").lstrip("/")
    if not path:
        return

    db_path = Path(path)
    if db_path.suffix != ".db":
        return

    db_dir = db_path.parent
    if str(db_dir) in {".", ""}:
        return

    os.makedirs(db_dir, exist_ok=True)

