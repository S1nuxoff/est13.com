from __future__ import annotations

import mimetypes
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.bot_text import BotText
from est13_core.db.repositories.bot_text import BotTextRepository

from ..deps import get_db, require_admin_token
from ..schemas.texts import BotTextCreate, BotTextIn, BotTextOut
from ..services.media import media_root, save_upload_image


def register(app: FastAPI) -> None:
    @app.get("/api/texts", dependencies=[Depends(require_admin_token)])
    async def list_texts(
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> list[BotTextOut]:
        result = await db.execute(select(BotText).order_by(BotText.key))
        return [
            BotTextOut(
                key=t.key, value=t.value, photo_path=getattr(t, "photo_path", None)
            )
            for t in result.scalars().all()
        ]

    @app.post("/api/texts", dependencies=[Depends(require_admin_token)])
    async def create_text(
        payload: BotTextCreate, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> BotTextOut:
        exists = await db.execute(select(BotText.key).where(BotText.key == payload.key))
        if exists.first() is not None:
            raise HTTPException(status_code=409, detail="Key already exists")
        db.add(BotText(key=payload.key, value=payload.value))
        await db.commit()
        return BotTextOut(key=payload.key, value=payload.value, photo_path=None)

    @app.get("/api/texts/{key}", dependencies=[Depends(require_admin_token)])
    async def get_text(
        key: str, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> BotTextOut:
        obj = await db.get(BotText, key)
        if obj is None:
            raise HTTPException(status_code=404, detail="Not found")
        return BotTextOut(
            key=obj.key, value=obj.value, photo_path=getattr(obj, "photo_path", None)
        )

    @app.put("/api/texts/{key}", dependencies=[Depends(require_admin_token)])
    async def set_text(
        key: str, payload: BotTextIn, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> BotTextOut:
        await BotTextRepository(db).set(key, payload.value)
        await db.commit()
        obj = await db.get(BotText, key)
        return BotTextOut(
            key=key,
            value=payload.value,
            photo_path=getattr(obj, "photo_path", None) if obj else None,
        )

    @app.get("/api/texts/{key}/photo", dependencies=[Depends(require_admin_token)])
    async def text_photo(
        key: str, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> Response:
        obj = await db.get(BotText, key)
        if obj is None:
            raise HTTPException(status_code=404, detail="Not found")
        rel = getattr(obj, "photo_path", None)
        if not rel:
            raise HTTPException(status_code=404, detail="No photo")
        abs_path = media_root() / str(rel)
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail="No photo")
        content = abs_path.read_bytes()
        media_type = mimetypes.guess_type(str(abs_path))[0] or "image/jpeg"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )

    @app.post("/api/texts/{key}/photo", dependencies=[Depends(require_admin_token)])
    async def set_text_photo(
        key: str,
        db: Annotated[AsyncSession, Depends(get_db)],
        file: UploadFile = File(...),
    ) -> BotTextOut:
        obj = await db.get(BotText, key)
        if obj is None:
            raise HTTPException(status_code=404, detail="Not found")

        rel = await save_upload_image(file, folder=f"texts/{key}", prefix="text")
        old_rel = getattr(obj, "photo_path", None)
        obj.photo_path = rel
        await db.commit()

        if old_rel:
            try:
                old_abs = media_root() / str(old_rel)
                if old_abs.exists():
                    old_abs.unlink()
            except Exception:
                pass

        return BotTextOut(
            key=obj.key, value=obj.value, photo_path=getattr(obj, "photo_path", None)
        )

    @app.delete("/api/texts/{key}/photo", dependencies=[Depends(require_admin_token)])
    async def clear_text_photo(
        key: str, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> BotTextOut:
        obj = await db.get(BotText, key)
        if obj is None:
            raise HTTPException(status_code=404, detail="Not found")
        old_rel = getattr(obj, "photo_path", None)
        obj.photo_path = None
        await db.commit()

        if old_rel:
            try:
                old_abs = media_root() / str(old_rel)
                if old_abs.exists():
                    old_abs.unlink()
            except Exception:
                pass

        return BotTextOut(key=obj.key, value=obj.value, photo_path=None)

    @app.delete("/api/texts/{key}", dependencies=[Depends(require_admin_token)])
    async def delete_text(
        key: str, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        obj = await db.get(BotText, key)
        old_rel = getattr(obj, "photo_path", None) if obj else None
        await db.execute(delete(BotText).where(BotText.key == key))
        await db.commit()
        if old_rel:
            try:
                old_abs = media_root() / str(old_rel)
                if old_abs.exists():
                    old_abs.unlink()
            except Exception:
                pass
        return {"ok": True}
