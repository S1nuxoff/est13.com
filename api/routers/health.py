from __future__ import annotations

from fastapi import FastAPI


def register(app: FastAPI) -> None:
    @app.get("/api/health")
    async def health() -> dict:
        return {"ok": True}

