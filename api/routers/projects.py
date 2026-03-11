from __future__ import annotations

import mimetypes
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.enums import LeadStatus
from est13_core.db.models.lead import Lead
from est13_core.db.models.project import Project
from est13_core.db.models.project_file import ProjectFile
from est13_core.db.models.project_note import ProjectNote
from est13_core.db.models.service import Service
from est13_core.db.models.user import User

from ..deps import get_db, get_super_admin_ids, is_super_admin, require_admin, require_admin_token
from ..schemas.projects import (
    ProjectCreate,
    ProjectNoteCreate,
    ProjectNotePatch,
    ProjectPatch,
)
from ..services.media import media_root


def _safe_filename(name: str | None) -> str:
    raw = (name or "").strip()
    raw = raw.replace("\\", "/").split("/")[-1]
    return raw or "file"


def _attachment_content_disposition(name: str | None) -> str:
    filename = _safe_filename(name).replace("\r", "").replace("\n", "").strip()
    suffix = Path(filename).suffix
    suffix_ascii = suffix.encode("ascii", "ignore").decode("ascii")

    filename_ascii = filename.encode("ascii", "ignore").decode("ascii").strip()
    filename_ascii = filename_ascii.replace("\\", "_").replace('"', "_")
    if not filename_ascii:
        filename_ascii = f"file{suffix_ascii}" if suffix_ascii else "file"
    if filename_ascii.startswith(".") and len(filename_ascii) > 1:
        filename_ascii = f"file{filename_ascii}"

    quoted = quote(filename, safe="")
    return f'attachment; filename="{filename_ascii}"; filename*=UTF-8\'\'{quoted}'


async def _save_upload_to_media(
    upload: UploadFile, *, folder: str, prefix: str = ""
) -> tuple[str, int]:
    media_dir = media_root()
    suffix = Path(_safe_filename(upload.filename)).suffix
    filename = (
        f"{prefix}_{secrets.token_hex(10)}{suffix}"
        if prefix
        else f"{secrets.token_hex(10)}{suffix}"
    )
    rel = f"{folder}/{filename}".replace("\\", "/")
    abs_path = media_dir / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    with abs_path.open("wb") as f:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            f.write(chunk)
    await upload.close()
    return rel, size


def register(app: FastAPI) -> None:
    @app.get("/api/projects", dependencies=[Depends(require_admin_token)])
    async def list_projects(
        db: Annotated[AsyncSession, Depends(get_db)], limit: int = 50
    ) -> dict:
        limit = min(max(int(limit), 1), 200)

        notes_count = (
            select(func.count(ProjectNote.id))
            .where(ProjectNote.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )
        files_count = (
            select(func.count(ProjectFile.id))
            .where(ProjectFile.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )

        stmt = (
            select(
                Project.id,
                Project.title,
                Project.description,
                Project.updated_at,
                Project.created_at,
                notes_count.label("notes_count"),
                files_count.label("files_count"),
                Lead.id,
                Lead.status,
                Service.title,
                User.id,
                User.tg_id,
                User.username,
                User.first_name,
                User.last_name,
            )
            .join(Lead, Lead.id == Project.lead_id)
            .join(Service, Service.id == Lead.service_id)
            .join(User, User.id == Lead.user_id)
            .order_by(desc(Project.updated_at), desc(Project.id))
            .limit(limit)
        )
        res = await db.execute(stmt)
        items = []
        for (
            project_id,
            title,
            description,
            updated_at,
            created_at,
            n_cnt,
            f_cnt,
            lead_id,
            lead_status,
            service_title,
            user_id,
            tg_id,
            username,
            first_name,
            last_name,
        ) in res.all():
            items.append(
                {
                    "id": int(project_id),
                    "lead_id": int(lead_id),
                    "title": title or "",
                    "description": description,
                    "updated_at": updated_at,
                    "created_at": created_at,
                    "notes_count": int(n_cnt or 0),
                    "files_count": int(f_cnt or 0),
                    "lead_status": (
                        lead_status.value
                        if hasattr(lead_status, "value")
                        else str(lead_status)
                    ),
                    "service_title": str(service_title),
                    "user": {
                        "id": int(user_id),
                        "tg_id": int(tg_id),
                        "username": username,
                        "first_name": first_name,
                        "last_name": last_name,
                    },
                }
            )
        return {"items": items}

    @app.post("/api/projects", dependencies=[Depends(require_admin_token)])
    async def create_project(
        payload: ProjectCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if admin is None:
            raise HTTPException(status_code=403, detail="Потрібна сесія адміністратора")

        lead = await db.get(Lead, int(payload.lead_id))
        if lead is None:
            raise HTTPException(status_code=404, detail="Lead not found")

        allowed = {
            LeadStatus.confirmed,
            LeadStatus.in_work,
            LeadStatus.paused,
            LeadStatus.done,
            LeadStatus.delivered,
            LeadStatus.client_not_confirmed,
        }
        if lead.status not in allowed:
            raise HTTPException(
                status_code=409, detail="Проєкт можна створити лише для лідів у роботі"
            )
        if getattr(lead, "accepted_at", None) is None:
            raise HTTPException(
                status_code=409, detail="Спочатку прийміть лід у роботу"
            )

        exists = await db.execute(
            select(Project.id).where(Project.lead_id == int(payload.lead_id)).limit(1)
        )
        existing_id = exists.scalar_one_or_none()
        if existing_id is not None:
            return {"ok": True, "id": int(existing_id), "already_exists": True}

        service = await db.get(Service, int(lead.service_id))
        default_title = f"Проєкт по заявці #{lead.id}"
        if service is not None and getattr(service, "title", None):
            default_title = f"{service.title} • #{lead.id}"

        p = Project(
            lead_id=int(lead.id),
            title=(payload.title or default_title).strip(),
            description=payload.description,
            created_by_admin_id=int(admin.id),
        )
        db.add(p)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            exists = await db.execute(
                select(Project.id)
                .where(Project.lead_id == int(payload.lead_id))
                .limit(1)
            )
            existing_id = exists.scalar_one_or_none()
            if existing_id is not None:
                return {"ok": True, "id": int(existing_id), "already_exists": True}
            raise
        return {"ok": True, "id": int(p.id), "already_exists": False}

    @app.get("/api/projects/{project_id}", dependencies=[Depends(require_admin_token)])
    async def project_details(
        project_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        p = await db.get(Project, int(project_id))
        if p is None:
            raise HTTPException(status_code=404, detail="Not found")

        super_admin_ids: set[int] = set()
        if not is_super_admin(admin):
            super_admin_ids = await get_super_admin_ids(db)

        lead = await db.get(Lead, int(p.lead_id))
        service = await db.get(Service, int(lead.service_id)) if lead else None
        user = await db.get(User, int(lead.user_id)) if lead else None

        notes_res = await db.execute(
            select(
                ProjectNote.id,
                ProjectNote.body,
                ProjectNote.created_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .outerjoin(AdminAccount, AdminAccount.id == ProjectNote.created_by_admin_id)
            .where(ProjectNote.project_id == int(project_id))
            .order_by(desc(ProjectNote.created_at), desc(ProjectNote.id))
            .limit(200)
        )
        notes = []
        for nid, body, created_at, a_id, a_user, a_name, a_emoji in notes_res.all():
            if a_id is not None and int(a_id) in super_admin_ids:
                continue
            notes.append(
                {
                    "id": int(nid),
                    "body": body or "",
                    "created_at": created_at,
                    "admin": (
                        {
                            "id": int(a_id),
                            "username": str(a_user),
                            "display_name": a_name,
                            "avatar_emoji": a_emoji,
                        }
                        if a_id is not None
                        else None
                    ),
                }
            )

        files_res = await db.execute(
            select(
                ProjectFile.id,
                ProjectFile.filename,
                ProjectFile.mime_type,
                ProjectFile.size_bytes,
                ProjectFile.created_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .outerjoin(AdminAccount, AdminAccount.id == ProjectFile.created_by_admin_id)
            .where(ProjectFile.project_id == int(project_id))
            .order_by(desc(ProjectFile.created_at), desc(ProjectFile.id))
            .limit(200)
        )
        files = []
        for (
            fid,
            filename,
            mime_type,
            size_bytes,
            created_at,
            a_id,
            a_user,
            a_name,
            a_emoji,
        ) in files_res.all():
            if a_id is not None and int(a_id) in super_admin_ids:
                continue
            files.append(
                {
                    "id": int(fid),
                    "filename": filename or "",
                    "mime_type": mime_type,
                    "size_bytes": int(size_bytes) if size_bytes is not None else None,
                    "created_at": created_at,
                    "admin": (
                        {
                            "id": int(a_id),
                            "username": str(a_user),
                            "display_name": a_name,
                            "avatar_emoji": a_emoji,
                        }
                        if a_id is not None
                        else None
                    ),
                }
            )

        return {
            "id": int(p.id),
            "lead_id": int(p.lead_id),
            "title": p.title or "",
            "description": p.description,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "lead": (
                {
                    "id": int(lead.id),
                    "status": lead.status.value,
                    "service_title": service.title if service else "",
                    "user": {
                        "id": user.id if user else lead.user_id,
                        "tg_id": int(user.tg_id) if user else None,
                        "username": user.username if user else None,
                        "first_name": user.first_name if user else None,
                        "last_name": user.last_name if user else None,
                    },
                }
                if lead is not None
                else None
            ),
            "notes": notes,
            "files": files,
        }

    @app.patch(
        "/api/projects/{project_id}", dependencies=[Depends(require_admin_token)]
    )
    async def patch_project(
        project_id: int,
        payload: ProjectPatch,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> dict:
        p = await db.get(Project, int(project_id))
        if p is None:
            raise HTTPException(status_code=404, detail="Not found")
        if payload.title is not None:
            p.title = payload.title
        if "description" in payload.model_fields_set:
            p.description = payload.description
        await db.commit()
        return {"ok": True}

    @app.delete(
        "/api/projects/{project_id}", dependencies=[Depends(require_admin_token)]
    )
    async def delete_project(
        project_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if not is_super_admin(admin):
            raise HTTPException(status_code=403, detail="Only super admin can delete projects")

        p = await db.get(Project, int(project_id))
        if p is None:
            raise HTTPException(status_code=404, detail="Not found")

        file_rows = await db.execute(
            select(ProjectFile.path).where(ProjectFile.project_id == int(project_id))
        )
        paths = [str(p) for (p,) in file_rows.all() if p]

        await db.delete(p)
        await db.commit()

        if paths:
            root = media_root()
            for rel in paths:
                try:
                    abs_path = root / rel
                    if abs_path.exists():
                        abs_path.unlink()
                except Exception:
                    pass

        return {"ok": True}

    @app.post(
        "/api/projects/{project_id}/notes", dependencies=[Depends(require_admin_token)]
    )
    async def add_project_note(
        project_id: int,
        payload: ProjectNoteCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if admin is None:
            raise HTTPException(status_code=403, detail="Потрібна сесія адміністратора")
        p = await db.get(Project, int(project_id))
        if p is None:
            raise HTTPException(status_code=404, detail="Not found")
        body = (payload.body or "").strip()
        if not body:
            raise HTTPException(status_code=400, detail="Empty note")
        db.add(
            ProjectNote(
                project_id=int(project_id), body=body, created_by_admin_id=int(admin.id)
            )
        )
        p.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": True}

    @app.delete(
        "/api/project_notes/{note_id}", dependencies=[Depends(require_admin_token)]
    )
    async def delete_project_note(
        note_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        note = await db.get(ProjectNote, int(note_id))
        if note is None:
            raise HTTPException(status_code=404, detail="Not found")
        p = await db.get(Project, int(note.project_id))
        await db.delete(note)
        if p is not None:
            p.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": True}

    @app.patch(
        "/api/project_notes/{note_id}", dependencies=[Depends(require_admin_token)]
    )
    async def patch_project_note(
        note_id: int,
        payload: ProjectNotePatch,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if admin is None:
            raise HTTPException(status_code=403, detail="Потрібна сесія адміністратора")

        note = await db.get(ProjectNote, int(note_id))
        if note is None:
            raise HTTPException(status_code=404, detail="Not found")

        if payload.body is not None:
            body = payload.body.strip()
            if not body:
                raise HTTPException(status_code=400, detail="Empty note")
            note.body = body

        p = await db.get(Project, int(note.project_id))
        if p is not None:
            p.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": True}

    @app.post(
        "/api/projects/{project_id}/files", dependencies=[Depends(require_admin_token)]
    )
    async def upload_project_file(
        project_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
        file: UploadFile = File(...),
    ) -> dict:
        if admin is None:
            raise HTTPException(status_code=403, detail="Потрібна сесія адміністратора")
        p = await db.get(Project, int(project_id))
        if p is None:
            raise HTTPException(status_code=404, detail="Not found")

        orig = _safe_filename(file.filename)
        rel, size = await _save_upload_to_media(
            file, folder=f"projects/{project_id}", prefix="file"
        )
        pf = ProjectFile(
            project_id=int(project_id),
            filename=orig,
            mime_type=getattr(file, "content_type", None),
            size_bytes=int(size),
            path=rel,
            created_by_admin_id=int(admin.id),
        )
        db.add(pf)
        p.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {
            "ok": True,
            "file": {
                "id": int(pf.id),
                "filename": pf.filename,
                "mime_type": pf.mime_type,
                "size_bytes": pf.size_bytes,
                "created_at": pf.created_at,
            },
        }

    @app.get(
        "/api/project_files/{file_id}", dependencies=[Depends(require_admin_token)]
    )
    async def download_project_file(
        file_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> Response:
        pf = await db.get(ProjectFile, int(file_id))
        if pf is None:
            raise HTTPException(status_code=404, detail="Not found")
        abs_path = media_root() / str(pf.path)
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail="Not found")
        content = abs_path.read_bytes()
        media_type = (
            pf.mime_type
            or mimetypes.guess_type(str(abs_path))[0]
            or "application/octet-stream"
        )
        filename = _safe_filename(pf.filename)
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Cache-Control": "private, max-age=60",
                "Content-Disposition": _attachment_content_disposition(filename),
            },
        )

    @app.delete(
        "/api/project_files/{file_id}", dependencies=[Depends(require_admin_token)]
    )
    async def delete_project_file(
        file_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        pf = await db.get(ProjectFile, int(file_id))
        if pf is None:
            raise HTTPException(status_code=404, detail="Not found")
        p = await db.get(Project, int(pf.project_id))
        rel = pf.path
        await db.delete(pf)
        if p is not None:
            p.updated_at = datetime.now(timezone.utc)
        await db.commit()
        if rel:
            try:
                abs_path = media_root() / str(rel)
                if abs_path.exists():
                    abs_path.unlink()
            except Exception:
                pass
        return {"ok": True}
