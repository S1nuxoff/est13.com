from __future__ import annotations

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.repositories.bot_text import BotTextRepository

from ..deps import get_db, require_admin_token
from ..schemas.admins import AppSettingsOut, AppSettingsPatchIn
from ..services.support import get_support_auto_disable_minutes


def register(app: FastAPI) -> None:
    @app.get("/api/settings", dependencies=[Depends(require_admin_token)])
    async def get_app_settings(
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> AppSettingsOut:
        minutes = await get_support_auto_disable_minutes(db)
        return AppSettingsOut(support_auto_disable_minutes=int(minutes))

    @app.patch("/api/settings", dependencies=[Depends(require_admin_token)])
    async def patch_app_settings(
        payload: AppSettingsPatchIn,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> AppSettingsOut:
        if payload.support_auto_disable_minutes is not None:
            v = int(payload.support_auto_disable_minutes)
            if v < 1 or v > 60 * 24 * 7:
                raise HTTPException(
                    status_code=400, detail="support_auto_disable_minutes out of range"
                )
            await BotTextRepository(db).set("support_auto_disable_minutes", str(v))
            await db.commit()
        minutes = await get_support_auto_disable_minutes(db)
        return AppSettingsOut(support_auto_disable_minutes=int(minutes))
