from __future__ import annotations

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from est13_core.config import Settings
from bot.middlewares.db import DbSessionMiddleware
from bot.routers import router as root_router


def build_bot(settings: Settings) -> Bot:
    return Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def build_dispatcher(db_sessionmaker) -> Dispatcher:
    dp = Dispatcher()
    dp.update.middleware(DbSessionMiddleware(db_sessionmaker))
    dp.include_router(root_router)
    return dp
