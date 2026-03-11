from __future__ import annotations

import asyncio
import logging

from bot.bot_factory import build_bot, build_dispatcher
from est13_core.config import get_settings
from est13_core.db.session import create_engine_and_sessionmaker, ensure_sqlite_data_dir
from bot.logging_setup import setup_logging
from bot.startup import register_lifecycle


async def _run() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    logger = logging.getLogger("est13_bot")

    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN is not set. Put it into .env (see .env.example).")

    await ensure_sqlite_data_dir(settings.database_url)
    engine, sessionmaker = create_engine_and_sessionmaker(settings.database_url)

    bot = build_bot(settings)
    dp = build_dispatcher(sessionmaker)
    register_lifecycle(dp)

    try:
        logger.info("Bot starting (env=%s)", settings.app_env)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        await engine.dispose()


def main() -> None:
    asyncio.run(_run())
