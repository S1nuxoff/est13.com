from __future__ import annotations

import mimetypes
import secrets
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile

from est13_core.config import get_settings


def media_root() -> Path:
    return Path(get_settings().media_dir)


def guess_suffix(
    *, filename: str | None, content_type: str | None, default: str = ".bin"
) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix:
        return suffix
    guessed = mimetypes.guess_extension(content_type or "") or ""
    return guessed if guessed else default


async def save_upload_image(
    upload: UploadFile, *, folder: str, prefix: str = ""
) -> str:
    ct = upload.content_type or ""
    if not ct.startswith("image/"):
        raise HTTPException(status_code=400, detail="Підтримуються лише зображення")

    suffix = guess_suffix(
        filename=upload.filename, content_type=upload.content_type, default=".jpg"
    )
    name = (prefix + "_" if prefix else "") + secrets.token_hex(16) + suffix
    rel = f"{folder}/{name}".replace("\\", "/")
    abs_path = media_root() / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Порожній файл")
    abs_path.write_bytes(content)
    return rel


async def save_upload_to_media(
    upload: UploadFile, *, folder: str, prefix: str = ""
) -> Tuple[str, int]:
    suffix = guess_suffix(
        filename=upload.filename, content_type=upload.content_type, default=".bin"
    )
    name = (prefix + "_" if prefix else "") + secrets.token_hex(16) + suffix
    rel = f"{folder}/{name}".replace("\\", "/")
    abs_path = media_root() / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Порожній файл")
    abs_path.write_bytes(content)
    return rel, len(content)
