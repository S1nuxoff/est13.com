from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.config import get_settings
from est13_core.db.models.admin_account import AdminAccount


def hash_password(password: str) -> str:
    iterations = 120_000
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, it_s, salt_hex, hash_hex = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(it_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


async def ensure_seed_admin(db: AsyncSession) -> None:
    settings = get_settings()
    username = (settings.admin_username or "admin").strip().lower()
    password = settings.admin_password or "admin123"
    if not username or not password:
        return

    try:
        res = await db.execute(
            select(AdminAccount).where(AdminAccount.username == username)
        )
        admin = res.scalar_one_or_none()
    except Exception:
        # DB not migrated yet.
        return
    if admin is None:
        admin = AdminAccount(
            username=username,
            display_name="Адміністратор",
            password_hash=hash_password(password),
            is_active=True,
            is_super=True,
            created_at=datetime.utcnow(),
            last_login_at=None,
        )
        db.add(admin)
        await db.commit()
        return

    updated = False
    if not admin.password_hash:
        admin.password_hash = hash_password(password)
        updated = True
    if not bool(getattr(admin, "is_super", False)):
        admin.is_super = True
        updated = True
    if updated:
        await db.commit()


def new_admin_session_token() -> str:
    return secrets.token_urlsafe(32)


def admin_session_expires_at(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def require_admin_db_available(admin: AdminAccount | None) -> AdminAccount:
    if admin is None:
        raise HTTPException(status_code=401, detail="Потрібен вхід адміністратора")
    return admin
