"""leads and editable content

Revision ID: 0002_leads_and_content
Revises: 0001_create_users
Create Date: 2026-02-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_leads_and_content"
down_revision = "0001_create_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Important: create enum types once (and disable per-table auto-create),
    # otherwise SQLAlchemy will attempt to create the same type again during table DDL.
    question_type = postgresql.ENUM(
        "text",
        "single_choice",
        "phone",
        "email",
        name="question_type",
        create_type=False,
    )
    lead_status = postgresql.ENUM(
        "in_progress",
        "submitted",
        "cancelled",
        name="lead_status",
        create_type=False,
    )
    admin_role = postgresql.ENUM(
        "admin",
        "manager",
        name="admin_role",
        create_type=False,
    )

    bind = op.get_bind()
    question_type.create(bind, checkfirst=True)
    lead_status.create(bind, checkfirst=True)
    admin_role.create(bind, checkfirst=True)

    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="100"),
    )
    op.create_index(op.f("ix_services_slug"), "services", ["slug"], unique=True)

    op.create_table(
        "bot_texts",
        sa.Column("key", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
    )

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("qtype", question_type, nullable=False, server_default="text"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("next_question_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["next_question_id"], ["questions.id"]),
    )
    op.create_index(op.f("ix_questions_service_id"), "questions", ["service_id"], unique=False)

    op.create_table(
        "question_options",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(length=128), nullable=False),
        sa.Column("value", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("next_question_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["next_question_id"], ["questions.id"]),
    )
    op.create_index(
        op.f("ix_question_options_question_id"), "question_options", ["question_id"], unique=False
    )

    op.create_table(
        "leads",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("status", lead_status, nullable=False, server_default="in_progress"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="RESTRICT"),
    )
    op.create_index(op.f("ix_leads_user_id"), "leads", ["user_id"], unique=False)
    op.create_index(op.f("ix_leads_service_id"), "leads", ["service_id"], unique=False)
    op.create_index(op.f("ix_leads_status"), "leads", ["status"], unique=False)

    op.create_table(
        "lead_answers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("option_id", sa.Integer(), nullable=True),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["option_id"], ["question_options.id"], ondelete="SET NULL"),
    )
    op.create_index(op.f("ix_lead_answers_lead_id"), "lead_answers", ["lead_id"], unique=False)
    op.create_index(op.f("ix_lead_answers_question_id"), "lead_answers", ["question_id"], unique=False)

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("tg_id", sa.BigInteger(), nullable=False),
        sa.Column("role", admin_role, nullable=False, server_default="admin"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_admin_users_tg_id"), "admin_users", ["tg_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_users_tg_id"), table_name="admin_users")
    op.drop_table("admin_users")

    op.drop_index(op.f("ix_lead_answers_question_id"), table_name="lead_answers")
    op.drop_index(op.f("ix_lead_answers_lead_id"), table_name="lead_answers")
    op.drop_table("lead_answers")

    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_service_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_user_id"), table_name="leads")
    op.drop_table("leads")

    op.drop_index(op.f("ix_question_options_question_id"), table_name="question_options")
    op.drop_table("question_options")

    op.drop_index(op.f("ix_questions_service_id"), table_name="questions")
    op.drop_table("questions")

    op.drop_table("bot_texts")

    op.drop_index(op.f("ix_services_slug"), table_name="services")
    op.drop_table("services")

    bind = op.get_bind()
    sa.Enum(name="admin_role").drop(bind, checkfirst=True)
    sa.Enum(name="lead_status").drop(bind, checkfirst=True)
    sa.Enum(name="question_type").drop(bind, checkfirst=True)
