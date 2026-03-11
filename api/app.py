from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from est13_core.config import get_settings
from est13_core.db.session import create_engine_and_sessionmaker

from .services.auth import ensure_seed_admin
from .routers import (
    admins,
    broadcast,
    dashboard,
    health,
    leads,
    notifications,
    projects,
    services,
    settings,
    texts,
    users,
    webapp,
)

logger = logging.getLogger("est13_api")


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings_obj = get_settings()
        engine, sessionmaker = create_engine_and_sessionmaker(settings_obj.database_url)
        app.state.engine = engine
        app.state.sessionmaker = sessionmaker
        try:
            async with sessionmaker() as session:
                await ensure_seed_admin(session)
            yield
        finally:
            await engine.dispose()

    app = FastAPI(title="Est13 Admin API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        # Mini App + Admin UI use header-based auth (Telegram initData / X-Admin-Token),
        # so we don't need credentialed CORS. This also avoids invalid "*" + credentials.
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    webapp.register(app)
    settings.register(app)
    health.register(app)
    admins.register(app)
    dashboard.register(app)
    users.register(app)
    notifications.register(app)
    broadcast.register(app)
    services.register(app)
    texts.register(app)
    leads.register(app)
    projects.register(app)
    return app
