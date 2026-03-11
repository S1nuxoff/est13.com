from __future__ import annotations

from .app import create_app

app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8992)
