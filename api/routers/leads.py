from __future__ import annotations

import mimetypes
from datetime import datetime, timezone
from io import BytesIO
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import Response
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.admin_account import AdminAccount
from est13_core.db.models.enums import LeadStatus
from est13_core.db.models.lead import Lead
from est13_core.db.models.lead_answer import LeadAnswer
from est13_core.db.models.lead_event import LeadEvent
from est13_core.db.models.question import Question
from est13_core.db.models.question_option import QuestionOption
from est13_core.db.models.project import Project
from est13_core.db.models.project_file import ProjectFile
from est13_core.db.models.service import Service
from est13_core.db.models.user import User
from est13_core.db.repositories.lead import LeadRepository

from ..deps import get_db, get_super_admin_ids, is_super_admin, require_admin, require_admin_token
from ..schemas.leads import LeadStatusPatch
from ..services.bot import fetch_telegram_file_bytes, notify_user_lead_stage
from ..services.lead_workflow import ADMIN_LEAD_TRANSITIONS, CLIENT_ONLY_LEAD_STATUSES
from ..services.media import media_root


def register(app: FastAPI) -> None:
    @app.get(
        "/api/lead_answers/{answer_id}/photo",
        dependencies=[Depends(require_admin_token)],
    )
    async def lead_answer_photo(
        answer_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> Response:
        ans = await db.get(LeadAnswer, answer_id)
        if ans is None:
            raise HTTPException(status_code=404, detail="Not found")

        file_id = getattr(ans, "photo_file_id", None)
        rel = getattr(ans, "photo_path", None)
        if not file_id and not rel:
            raise HTTPException(status_code=404, detail="No photo")

        if rel:
            abs_path = media_root() / str(rel)
            if abs_path.exists():
                content = abs_path.read_bytes()
                media_type = mimetypes.guess_type(str(abs_path))[0] or "image/jpeg"
                return Response(
                    content=content,
                    media_type=media_type,
                    headers={"Cache-Control": "private, max-age=300"},
                )

        if not file_id:
            raise HTTPException(status_code=404, detail="No photo")

        content, media_type = await fetch_telegram_file_bytes(str(file_id))
        return Response(
            content=content,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )

    @app.get("/api/leads", dependencies=[Depends(require_admin_token)])
    async def list_leads(
        db: Annotated[AsyncSession, Depends(get_db)],
        limit: int = 20,
        unaccepted_only: bool = False,
        admin: Annotated[AdminAccount | None, Depends(require_admin)] = None,
    ) -> dict:
        limit = min(max(int(limit), 1), 200)
        super_admin_ids: set[int] = set()
        if not is_super_admin(admin):
            super_admin_ids = await get_super_admin_ids(db)
        stmt = (
            select(
                Lead.id,
                Service.title,
                User.id,
                User.tg_id,
                User.username,
                User.first_name,
                User.last_name,
                getattr(User, "photo_file_id", None),
                Lead.started_at,
                Lead.submitted_at,
                Lead.status,
                getattr(Lead, "source", None),
                Lead.accepted_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .join(Service, Service.id == Lead.service_id)
            .join(User, User.id == Lead.user_id)
            .outerjoin(AdminAccount, AdminAccount.id == Lead.accepted_by_admin_id)
            .order_by(desc(Lead.id))
            .limit(limit)
        )

        if unaccepted_only:
            stmt = (
                stmt.where(Lead.status == LeadStatus.awaiting_review)
                .where(Lead.submitted_at.is_not(None))
                .where(Lead.accepted_at.is_(None))
            )

        res = await db.execute(stmt)
        items = []
        for (
            lead_id,
            title,
            user_id,
            tg_id,
            username,
            first_name,
            last_name,
            photo_file_id,
            started_at,
            submitted_at,
            status,
            source,
            accepted_at,
            admin_id,
            admin_username,
            admin_display_name,
            admin_avatar_emoji,
        ) in res.all():
            admin_id_int = int(admin_id) if admin_id is not None else None
            accepted_by_admin = None
            if admin_id_int is not None and admin_id_int not in super_admin_ids:
                accepted_by_admin = {
                    "id": admin_id_int,
                    "username": str(admin_username),
                    "display_name": admin_display_name,
                    "avatar_emoji": admin_avatar_emoji,
                }
            items.append(
                {
                    "id": int(lead_id),
                    "service_title": str(title),
                    "user_id": int(user_id),
                    "user_tg_id": int(tg_id),
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "photo_file_id": photo_file_id,
                    "started_at": started_at,
                    "submitted_at": submitted_at,
                    "status": status.value,
                    "source": (
                        source.value
                        if hasattr(source, "value")
                        else (str(source) if source else None)
                    ),
                    "accepted_at": accepted_at,
                    "accepted_by_admin": accepted_by_admin,
                }
            )
        return {"items": items}

    @app.get("/api/leads/{lead_id}", dependencies=[Depends(require_admin_token)])
    async def lead_details(
        lead_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        lead = await LeadRepository(db).get(lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Not found")

        super_admin_ids: set[int] = set()
        if not is_super_admin(admin):
            super_admin_ids = await get_super_admin_ids(db)

        if (
            admin is not None
            and lead.status == LeadStatus.awaiting_review
            and getattr(lead, "accepted_at", None) is None
            and getattr(lead, "submitted_at", None) is not None
        ):
            now = datetime.now(timezone.utc)
            q = (
                update(Lead)
                .where(Lead.id == int(lead_id))
                .where(Lead.accepted_at.is_(None))
                .where(Lead.status == LeadStatus.awaiting_review)
                .values(
                    accepted_at=now,
                    accepted_by_admin_id=int(admin.id),
                    status=LeadStatus.in_review,
                )
                .returning(Lead.accepted_at, Lead.accepted_by_admin_id, Lead.status)
            )
            res = await db.execute(q)
            row = res.first()
            if row is not None:
                db.add(
                    LeadEvent(
                        lead_id=int(lead_id),
                        from_status=LeadStatus.awaiting_review,
                        to_status=LeadStatus.in_review,
                        admin_id=int(admin.id),
                    )
                )
                await db.commit()
                await db.refresh(lead)
                try:
                    await notify_user_lead_stage(
                        db,
                        lead=lead,
                        reason="Менеджер відкрив вашу заявку та почав перевірку.",
                    )
                except Exception:
                    pass

        stmt = (
            select(
                LeadAnswer.id,
                Question.text,
                LeadAnswer.text_value,
                LeadAnswer.photo_file_id,
                LeadAnswer.photo_path,
                QuestionOption.text,
            )
            .join(Question, LeadAnswer.question_id == Question.id)
            .outerjoin(QuestionOption, LeadAnswer.option_id == QuestionOption.id)
            .where(LeadAnswer.lead_id == lead_id)
            .order_by(LeadAnswer.id)
        )
        res = await db.execute(stmt)
        answers = []
        for (
            ans_id,
            q_text,
            text_value,
            photo_file_id,
            photo_path,
            option_text,
        ) in res.all():
            if option_text:
                answer_text = option_text
            elif photo_file_id or photo_path:
                answer_text = "PHOTO" + (f": {text_value}" if text_value else "")
            else:
                answer_text = text_value or ""
            answers.append(
                {
                    "id": int(ans_id),
                    "question": q_text,
                    "answer": answer_text,
                    "has_photo": bool(photo_file_id or photo_path),
                }
            )

        user = await db.get(User, lead.user_id)
        service = await db.get(Service, lead.service_id)
        accepted_admin = None
        if getattr(lead, "accepted_by_admin_id", None):
            accepted_admin = await db.get(AdminAccount, int(lead.accepted_by_admin_id))  # type: ignore[arg-type]
            if (
                accepted_admin is not None
                and int(accepted_admin.id) in super_admin_ids
            ):
                accepted_admin = None
        proj_res = await db.execute(
            select(Project.id).where(Project.lead_id == int(lead_id)).limit(1)
        )
        project_id = proj_res.scalar_one_or_none()

        ev_rows = await db.execute(
            select(
                LeadEvent.id,
                LeadEvent.from_status,
                LeadEvent.to_status,
                LeadEvent.created_at,
                AdminAccount.id,
                AdminAccount.username,
                AdminAccount.display_name,
                AdminAccount.avatar_emoji,
            )
            .outerjoin(AdminAccount, AdminAccount.id == LeadEvent.admin_id)
            .where(LeadEvent.lead_id == int(lead_id))
            .order_by(LeadEvent.created_at.asc(), LeadEvent.id.asc())
        )
        events = []
        for (
            ev_id,
            from_status,
            to_status,
            created_at,
            a_id,
            a_user,
            a_name,
            a_emoji,
        ) in ev_rows.all():
            if a_id is not None and int(a_id) in super_admin_ids:
                continue
            events.append(
                {
                    "id": int(ev_id),
                    "from_status": (
                        from_status.value if from_status is not None else None
                    ),
                    "to_status": to_status.value if to_status is not None else None,
                    "created_at": created_at.isoformat() if created_at else None,
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
            "id": lead.id,
            "user_id": lead.user_id,
            "service_id": lead.service_id,
            "service_title": service.title if service else "",
            "source": (
                getattr(getattr(lead, "source", None), "value", None)
                or str(getattr(lead, "source", None) or "")
            )
            or None,
            "user": {
                "id": user.id if user else lead.user_id,
                "tg_id": int(user.tg_id) if user else None,
                "username": user.username if user else None,
                "first_name": user.first_name if user else None,
                "last_name": user.last_name if user else None,
                "photo_file_id": getattr(user, "photo_file_id", None) if user else None,
            },
            "status": lead.status.value,
            "started_at": lead.started_at,
            "submitted_at": lead.submitted_at,
            "accepted_at": getattr(lead, "accepted_at", None),
            "accepted_by_admin": (
                {
                    "id": int(accepted_admin.id),
                    "username": str(accepted_admin.username),
                    "display_name": getattr(accepted_admin, "display_name", None),
                    "avatar_emoji": getattr(accepted_admin, "avatar_emoji", None),
                }
                if accepted_admin is not None
                else None
            ),
            "answers": answers,
            "events": events,
            "project_id": int(project_id) if project_id is not None else None,
        }

    @app.patch(
        "/api/leads/{lead_id}/status", dependencies=[Depends(require_admin_token)]
    )
    async def set_lead_status(
        lead_id: int,
        payload: LeadStatusPatch,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        lead = await db.get(Lead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Not found")
        try:
            status = LeadStatus(payload.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid lead status")

        if admin is not None:
            if status in CLIENT_ONLY_LEAD_STATUSES and status != lead.status:
                raise HTTPException(
                    status_code=403, detail="Цей статус може встановлювати лише клієнт."
                )
            if lead.status in CLIENT_ONLY_LEAD_STATUSES and status != lead.status:
                raise HTTPException(
                    status_code=403,
                    detail="Лід ще на клієнтському етапі — статус змінює клієнт.",
                )

            allowed = ADMIN_LEAD_TRANSITIONS.get(lead.status)
            if allowed is not None and status != lead.status and status not in allowed:
                raise HTTPException(
                    status_code=409, detail="Недопустимий перехід статусу."
                )

        if (
            lead.status == LeadStatus.awaiting_review
            and getattr(lead, "accepted_at", None) is None
        ):
            if status != LeadStatus.awaiting_review:
                raise HTTPException(
                    status_code=409, detail="Спочатку прийміть лід на перевірку."
                )

        await LeadRepository(db).set_status(
            lead_id, status, admin_id=int(admin.id) if admin is not None else None
        )
        lead.status = status
        await db.commit()
        try:
            await notify_user_lead_stage(db, lead=lead)
        except Exception:
            pass
        return {"ok": True, "status": status.value}

    @app.post(
        "/api/leads/{lead_id}/accept", dependencies=[Depends(require_admin_token)]
    )
    async def accept_lead(
        lead_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if admin is None:
            raise HTTPException(status_code=403, detail="Потрібна сесія адміністратора")

        lead = await db.get(Lead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Not found")

        if lead.status != LeadStatus.awaiting_review or lead.submitted_at is None:
            raise HTTPException(status_code=400, detail="Лід ще не надіслано")

        now = datetime.now(timezone.utc)
        q = (
            update(Lead)
            .where(Lead.id == lead_id)
            .where(Lead.accepted_at.is_(None))
            .where(Lead.status == LeadStatus.awaiting_review)
            .values(
                accepted_at=now,
                accepted_by_admin_id=int(admin.id),
                status=LeadStatus.in_review,
            )
            .returning(Lead.accepted_at, Lead.accepted_by_admin_id, Lead.status)
        )
        res = await db.execute(q)
        row = res.first()
        if row is None:
            await db.rollback()
            await db.refresh(lead)
            if lead.accepted_at is not None and lead.accepted_by_admin_id is not None:
                other = await db.get(AdminAccount, int(lead.accepted_by_admin_id))
                raise HTTPException(
                    status_code=409,
                    detail="Лід уже прийнято"
                    + (f" ({other.display_name or other.username})" if other else ""),
                )
            raise HTTPException(status_code=409, detail="Лід уже прийнято")

        db.add(
            LeadEvent(
                lead_id=int(lead_id),
                from_status=LeadStatus.awaiting_review,
                to_status=LeadStatus.in_review,
                admin_id=int(admin.id),
            )
        )
        await db.commit()
        try:
            lead.status = LeadStatus.in_review
            await notify_user_lead_stage(
                db, lead=lead, reason="Менеджер почав перевірку вашої анкети."
            )
        except Exception:
            pass
        accepted_at, accepted_by_admin_id, status = row
        return {
            "ok": True,
            "id": lead_id,
            "accepted_at": accepted_at,
            "accepted_by_admin": {
                "id": int(admin.id),
                "username": str(admin.username),
                "display_name": getattr(admin, "display_name", None),
                "avatar_emoji": getattr(admin, "avatar_emoji", None),
            },
            "status": status.value if hasattr(status, "value") else str(status),
        }

    @app.delete("/api/leads/{lead_id}", dependencies=[Depends(require_admin_token)])
    async def delete_lead(
        lead_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        admin: Annotated[AdminAccount | None, Depends(require_admin)],
    ) -> dict:
        if not is_super_admin(admin):
            raise HTTPException(status_code=403, detail="Only super admin can delete leads")

        lead = await db.get(Lead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Not found")

        answer_rows = await db.execute(
            select(LeadAnswer.photo_path).where(LeadAnswer.lead_id == int(lead_id))
        )
        file_rows = await db.execute(
            select(ProjectFile.path)
            .join(Project, Project.id == ProjectFile.project_id)
            .where(Project.lead_id == int(lead_id))
        )
        paths: list[str] = []
        paths += [str(p) for (p,) in answer_rows.all() if p]
        paths += [str(p) for (p,) in file_rows.all() if p]

        await db.delete(lead)
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
