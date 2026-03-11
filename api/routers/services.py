from __future__ import annotations

import mimetypes
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.enums import QuestionType
from est13_core.db.models.question import Question
from est13_core.db.models.question_option import QuestionOption
from est13_core.db.models.service import Service
from est13_core.db.repositories.question import QuestionRepository
from est13_core.db.repositories.service import ServiceRepository

from ..deps import get_db, require_admin_token
from ..schemas.services import (
    OptionCreate,
    OptionPatch,
    QuestionCreate,
    QuestionOptionOut,
    QuestionOut,
    QuestionPatch,
    ServiceIn,
    ServiceOut,
    ServicePatch,
)
from ..services.media import media_root, save_upload_image


def register(app: FastAPI) -> None:
    @app.get("/api/services", dependencies=[Depends(require_admin_token)])
    async def list_services(
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> list[ServiceOut]:
        services = await ServiceRepository(db).list_all()
        return [
            ServiceOut(
                id=s.id,
                slug=s.slug,
                title=s.title,
                is_active=s.is_active,
                sort=s.sort,
                start_question_id=getattr(s, "start_question_id", None),
            )
            for s in services
        ]

    @app.post("/api/services", dependencies=[Depends(require_admin_token)])
    async def create_or_update_service(
        payload: ServiceIn, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> ServiceOut:
        service_repo = ServiceRepository(db)
        obj = await service_repo.get_by_slug(payload.slug)
        if obj is None:
            obj = await service_repo.ensure(
                slug=payload.slug, title=payload.title, sort=payload.sort
            )
            obj.is_active = payload.is_active
        else:
            obj.title = payload.title
            obj.sort = payload.sort
            obj.is_active = payload.is_active
        if payload.start_question_id is not None:
            obj.start_question_id = payload.start_question_id
        await db.commit()
        return ServiceOut(
            id=obj.id,
            slug=obj.slug,
            title=obj.title,
            is_active=obj.is_active,
            sort=obj.sort,
            start_question_id=getattr(obj, "start_question_id", None),
        )

    @app.patch(
        "/api/services/{service_id}", dependencies=[Depends(require_admin_token)]
    )
    async def patch_service(
        service_id: int,
        payload: ServicePatch,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> ServiceOut:
        obj = await db.get(Service, service_id)
        if obj is None:
            raise HTTPException(status_code=404, detail="Not found")
        if payload.title is not None:
            obj.title = payload.title
        if payload.is_active is not None:
            obj.is_active = payload.is_active
        if payload.sort is not None:
            obj.sort = payload.sort
        if "start_question_id" in payload.model_fields_set:
            obj.start_question_id = payload.start_question_id
        await db.commit()
        return ServiceOut(
            id=obj.id,
            slug=obj.slug,
            title=obj.title,
            is_active=obj.is_active,
            sort=obj.sort,
            start_question_id=getattr(obj, "start_question_id", None),
        )

    @app.delete(
        "/api/services/{service_id}", dependencies=[Depends(require_admin_token)]
    )
    async def delete_service(
        service_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        obj = await db.get(Service, service_id)
        if obj is None:
            raise HTTPException(status_code=404, detail="Not found")
        obj.is_active = False
        await db.commit()
        return {"ok": True}

    @app.get(
        "/api/services/{service_id}/questions",
        dependencies=[Depends(require_admin_token)],
    )
    async def list_questions(
        service_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        qrepo = QuestionRepository(db)
        questions = await qrepo.list_for_service(service_id, include_archived=True)
        out = []
        for q in questions:
            opts = await qrepo.list_options(q.id, include_archived=True)
            out.append(
                {
                    "id": q.id,
                    "service_id": q.service_id,
                    "code": q.code,
                    "text": q.text,
                    "qtype": q.qtype.value,
                    "is_required": q.is_required,
                    "sort": q.sort,
                    "next_question_id": q.next_question_id,
                    "ends_flow": getattr(q, "ends_flow", False),
                    "pos_x": getattr(q, "pos_x", 0),
                    "pos_y": getattr(q, "pos_y", 0),
                    "photo_path": getattr(q, "photo_path", None),
                    "is_archived": getattr(q, "is_archived", False),
                    "options": [
                        {
                            "id": o.id,
                            "question_id": o.question_id,
                            "text": o.text,
                            "value": o.value,
                            "sort": o.sort,
                            "keyboard_row": getattr(o, "keyboard_row", 0),
                            "keyboard_col": getattr(o, "keyboard_col", 0),
                            "next_question_id": o.next_question_id,
                            "ends_flow": getattr(o, "ends_flow", False),
                            "is_archived": getattr(o, "is_archived", False),
                        }
                        for o in opts
                    ],
                }
            )
        return {"service_id": service_id, "questions": out}

    @app.post(
        "/api/services/{service_id}/questions",
        dependencies=[Depends(require_admin_token)],
    )
    async def create_question(
        service_id: int,
        payload: QuestionCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> QuestionOut:
        service = await db.get(Service, service_id)
        if service is None:
            raise HTTPException(status_code=404, detail="Service not found")
        try:
            qtype = QuestionType(payload.qtype)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid question type")

        q = Question(
            service_id=service_id,
            code=payload.code,
            text=payload.text,
            qtype=qtype,
            is_required=payload.is_required,
            sort=payload.sort,
            next_question_id=payload.next_question_id,
        )
        q.pos_x = int(payload.pos_x)
        q.pos_y = int(payload.pos_y)
        db.add(q)
        await db.flush()
        await db.commit()
        return QuestionOut(
            id=q.id,
            service_id=q.service_id,
            code=q.code,
            text=q.text,
            qtype=q.qtype.value,
            is_required=q.is_required,
            sort=q.sort,
            next_question_id=q.next_question_id,
            ends_flow=getattr(q, "ends_flow", False),
            pos_x=getattr(q, "pos_x", 0),
            pos_y=getattr(q, "pos_y", 0),
            photo_path=getattr(q, "photo_path", None),
            is_archived=getattr(q, "is_archived", False),
            options=[],
        )

    @app.patch(
        "/api/questions/{question_id}", dependencies=[Depends(require_admin_token)]
    )
    async def patch_question(
        question_id: int,
        payload: QuestionPatch,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> QuestionOut:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Not found")
        if payload.code is not None:
            q.code = payload.code
        if payload.text is not None:
            q.text = payload.text
        if payload.qtype is not None:
            try:
                q.qtype = QuestionType(payload.qtype)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid question type")
        if payload.is_required is not None:
            q.is_required = payload.is_required
        if payload.sort is not None:
            q.sort = payload.sort
        if "next_question_id" in payload.model_fields_set:
            q.next_question_id = payload.next_question_id
            if q.next_question_id is not None:
                q.ends_flow = False
        if "ends_flow" in payload.model_fields_set:
            q.ends_flow = bool(payload.ends_flow)
            if q.ends_flow:
                q.next_question_id = None
        if payload.pos_x is not None:
            q.pos_x = payload.pos_x
        if payload.pos_y is not None:
            q.pos_y = payload.pos_y
        if payload.is_archived is not None:
            q.is_archived = payload.is_archived
        await db.commit()

        opts = await QuestionRepository(db).list_options(q.id, include_archived=True)
        return QuestionOut(
            id=q.id,
            service_id=q.service_id,
            code=q.code,
            text=q.text,
            qtype=q.qtype.value,
            is_required=q.is_required,
            sort=q.sort,
            next_question_id=q.next_question_id,
            ends_flow=getattr(q, "ends_flow", False),
            pos_x=getattr(q, "pos_x", 0),
            pos_y=getattr(q, "pos_y", 0),
            photo_path=getattr(q, "photo_path", None),
            is_archived=getattr(q, "is_archived", False),
            options=[
                QuestionOptionOut(
                    id=o.id,
                    question_id=o.question_id,
                    text=o.text,
                    value=o.value,
                    sort=o.sort,
                    keyboard_row=getattr(o, "keyboard_row", 0),
                    keyboard_col=getattr(o, "keyboard_col", 0),
                    next_question_id=o.next_question_id,
                    ends_flow=getattr(o, "ends_flow", False),
                    is_archived=getattr(o, "is_archived", False),
                )
                for o in opts
            ],
        )

    @app.get(
        "/api/questions/{question_id}/photo",
        dependencies=[Depends(require_admin_token)],
    )
    async def get_question_photo(
        question_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> Response:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found")
        rel = getattr(q, "photo_path", None)
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

    @app.post(
        "/api/questions/{question_id}/photo",
        dependencies=[Depends(require_admin_token)],
    )
    async def upload_question_photo(
        question_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        file: UploadFile = File(...),
    ) -> QuestionOut:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found")

        old_rel = getattr(q, "photo_path", None)
        rel = await save_upload_image(
            file, folder=f"questions/{question_id}", prefix=str(question_id)
        )
        q.photo_path = rel
        await db.commit()

        if old_rel and old_rel != rel:
            try:
                old_abs = media_root() / str(old_rel)
                if old_abs.exists():
                    old_abs.unlink()
            except Exception:
                pass

        opts = await QuestionRepository(db).list_options(q.id, include_archived=True)
        return QuestionOut(
            id=q.id,
            service_id=q.service_id,
            code=q.code,
            text=q.text,
            qtype=q.qtype.value,
            is_required=q.is_required,
            sort=q.sort,
            next_question_id=q.next_question_id,
            ends_flow=getattr(q, "ends_flow", False),
            pos_x=getattr(q, "pos_x", 0),
            pos_y=getattr(q, "pos_y", 0),
            photo_path=getattr(q, "photo_path", None),
            is_archived=getattr(q, "is_archived", False),
            options=[
                QuestionOptionOut(
                    id=o.id,
                    question_id=o.question_id,
                    text=o.text,
                    value=o.value,
                    sort=o.sort,
                    keyboard_row=getattr(o, "keyboard_row", 0),
                    keyboard_col=getattr(o, "keyboard_col", 0),
                    next_question_id=o.next_question_id,
                    ends_flow=getattr(o, "ends_flow", False),
                    is_archived=getattr(o, "is_archived", False),
                )
                for o in opts
            ],
        )

    @app.delete(
        "/api/questions/{question_id}/photo",
        dependencies=[Depends(require_admin_token)],
    )
    async def delete_question_photo(
        question_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> QuestionOut:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found")

        old_rel = getattr(q, "photo_path", None)
        q.photo_path = None
        await db.commit()

        if old_rel:
            try:
                old_abs = media_root() / str(old_rel)
                if old_abs.exists():
                    old_abs.unlink()
            except Exception:
                pass

        opts = await QuestionRepository(db).list_options(q.id, include_archived=True)
        return QuestionOut(
            id=q.id,
            service_id=q.service_id,
            code=q.code,
            text=q.text,
            qtype=q.qtype.value,
            is_required=q.is_required,
            sort=q.sort,
            next_question_id=q.next_question_id,
            ends_flow=getattr(q, "ends_flow", False),
            pos_x=getattr(q, "pos_x", 0),
            pos_y=getattr(q, "pos_y", 0),
            photo_path=getattr(q, "photo_path", None),
            is_archived=getattr(q, "is_archived", False),
            options=[
                QuestionOptionOut(
                    id=o.id,
                    question_id=o.question_id,
                    text=o.text,
                    value=o.value,
                    sort=o.sort,
                    keyboard_row=getattr(o, "keyboard_row", 0),
                    keyboard_col=getattr(o, "keyboard_col", 0),
                    next_question_id=o.next_question_id,
                    ends_flow=getattr(o, "ends_flow", False),
                    is_archived=getattr(o, "is_archived", False),
                )
                for o in opts
            ],
        )

    @app.delete(
        "/api/questions/{question_id}", dependencies=[Depends(require_admin_token)]
    )
    async def delete_question(
        question_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Not found")

        old_photo = getattr(q, "photo_path", None)

        async def _clear_inbound_refs() -> None:
            await db.execute(
                update(Question)
                .where(Question.next_question_id == question_id)
                .values(next_question_id=None)
            )
            await db.execute(
                update(QuestionOption)
                .where(QuestionOption.next_question_id == question_id)
                .values(next_question_id=None)
            )

        await _clear_inbound_refs()

        try:
            await db.delete(q)
            await db.commit()
            if old_photo:
                try:
                    abs_path = media_root() / str(old_photo)
                    if abs_path.exists():
                        abs_path.unlink()
                except Exception:
                    pass
            return {"ok": True, "archived": False}
        except IntegrityError:
            await db.rollback()
            await _clear_inbound_refs()
            await db.execute(
                update(Question)
                .where(Question.id == question_id)
                .values(is_archived=True, next_question_id=None)
            )
            await db.execute(
                update(QuestionOption)
                .where(QuestionOption.question_id == question_id)
                .values(is_archived=True, next_question_id=None)
            )
            await db.commit()
            return {"ok": True, "archived": True}

    @app.post(
        "/api/questions/{question_id}/options",
        dependencies=[Depends(require_admin_token)],
    )
    async def create_option(
        question_id: int,
        payload: OptionCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> QuestionOptionOut:
        q = await db.get(Question, question_id)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found")
        opt = QuestionOption(
            question_id=question_id,
            text=payload.text,
            value=payload.value,
            sort=payload.sort,
            keyboard_row=payload.keyboard_row,
            keyboard_col=payload.keyboard_col,
            next_question_id=None if payload.ends_flow else payload.next_question_id,
            ends_flow=bool(payload.ends_flow),
        )
        db.add(opt)
        await db.flush()
        await db.commit()
        return QuestionOptionOut(
            id=opt.id,
            question_id=opt.question_id,
            text=opt.text,
            value=opt.value,
            sort=opt.sort,
            keyboard_row=getattr(opt, "keyboard_row", 0),
            keyboard_col=getattr(opt, "keyboard_col", 0),
            next_question_id=opt.next_question_id,
            ends_flow=getattr(opt, "ends_flow", False),
            is_archived=getattr(opt, "is_archived", False),
        )

    @app.patch("/api/options/{option_id}", dependencies=[Depends(require_admin_token)])
    async def patch_option(
        option_id: int,
        payload: OptionPatch,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> QuestionOptionOut:
        opt = await db.get(QuestionOption, option_id)
        if opt is None:
            raise HTTPException(status_code=404, detail="Not found")
        if payload.text is not None:
            opt.text = payload.text
        if payload.value is not None:
            opt.value = payload.value
        if payload.sort is not None:
            opt.sort = payload.sort
        if payload.keyboard_row is not None:
            opt.keyboard_row = payload.keyboard_row
        if payload.keyboard_col is not None:
            opt.keyboard_col = payload.keyboard_col
        if "next_question_id" in payload.model_fields_set:
            opt.next_question_id = payload.next_question_id
            if opt.next_question_id is not None:
                opt.ends_flow = False
        if "ends_flow" in payload.model_fields_set:
            opt.ends_flow = bool(payload.ends_flow)
            if opt.ends_flow:
                opt.next_question_id = None
        await db.commit()
        return QuestionOptionOut(
            id=opt.id,
            question_id=opt.question_id,
            text=opt.text,
            value=opt.value,
            sort=opt.sort,
            keyboard_row=getattr(opt, "keyboard_row", 0),
            keyboard_col=getattr(opt, "keyboard_col", 0),
            next_question_id=opt.next_question_id,
            ends_flow=getattr(opt, "ends_flow", False),
            is_archived=getattr(opt, "is_archived", False),
        )

    @app.delete("/api/options/{option_id}", dependencies=[Depends(require_admin_token)])
    async def delete_option(
        option_id: int, db: Annotated[AsyncSession, Depends(get_db)]
    ) -> dict:
        opt = await db.get(QuestionOption, option_id)
        if opt is None:
            raise HTTPException(status_code=404, detail="Not found")
        await db.delete(opt)
        await db.commit()
        return {"ok": True}
