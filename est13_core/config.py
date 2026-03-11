from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    bot_token: str = ""
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    media_dir: str = "./data/media"

    app_env: str = "dev"
    log_level: str = "INFO"

    admin_tg_ids: str = ""
    admin_api_token: str = ""
    admin_username: str = ""
    admin_password: str = ""
    # If support is enabled for a user and the admin forgot to turn it off,
    # it will be automatically disabled after this amount of time (minutes)
    # unless extended by admin activity.
    support_auto_disable_minutes: int = 180
    # Telegram Mini App (WebApp) URL to open from the bot.
    webapp_url: str = ""
    # Allow opening WebApp endpoints without Telegram initData (dev/debug only).
    webapp_allow_anon: bool = False

    def parsed_admin_tg_ids(self) -> list[int]:
        ids: list[int] = []
        for part in self.admin_tg_ids.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                ids.append(int(part))
            except ValueError:
                continue
        return ids


@lru_cache
def get_settings() -> Settings:
    return Settings()
