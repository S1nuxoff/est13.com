from __future__ import annotations

import logging

from aiogram import Bot, Dispatcher
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo

from est13_core.config import get_settings


async def on_startup(bot: Bot) -> None:
    logger = logging.getLogger("est13_bot.startup")
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Старт"),
            BotCommand(command="cancel", description="Скасувати заявку"),
            BotCommand(command="health", description="Перевірка доступності"),
            BotCommand(command="admin", description="Адмін: останні заявки"),
        ]
    )
    settings = get_settings()
    if settings.webapp_url:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Відкрити міні-апку",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            )
        except Exception:
            logger.exception("Failed to set WebApp menu button")
    logger.info("Startup completed")


async def on_shutdown(bot: Bot) -> None:
    logger = logging.getLogger("est13_bot.shutdown")
    logger.info("Shutdown completed")


def register_lifecycle(dp: Dispatcher) -> None:
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
