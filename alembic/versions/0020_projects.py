"""projects + notes + files

Revision ID: 0020_projects
Revises: 0019_client_not_confirmed
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0020_projects"
down_revision = "0019_client_not_confirmed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_by_admin_id",
            sa.Integer(),
            sa.ForeignKey("admin_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_projects_lead_id", "projects", ["lead_id"])
    op.create_index("ix_projects_created_by_admin_id", "projects", ["created_by_admin_id"])
    op.create_index("ix_projects_created_at", "projects", ["created_at"])
    op.create_index("ix_projects_updated_at", "projects", ["updated_at"])

    op.create_table(
        "project_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_by_admin_id",
            sa.Integer(),
            sa.ForeignKey("admin_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_project_notes_project_id", "project_notes", ["project_id"])
    op.create_index("ix_project_notes_created_by_admin_id", "project_notes", ["created_by_admin_id"])
    op.create_index("ix_project_notes_created_at", "project_notes", ["created_at"])

    op.create_table(
        "project_files",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.Text(), nullable=False, server_default=""),
        sa.Column("mime_type", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("path", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_by_admin_id",
            sa.Integer(),
            sa.ForeignKey("admin_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_project_files_project_id", "project_files", ["project_id"])
    op.create_index("ix_project_files_created_by_admin_id", "project_files", ["created_by_admin_id"])
    op.create_index("ix_project_files_created_at", "project_files", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_project_files_created_at", table_name="project_files")
    op.drop_index("ix_project_files_created_by_admin_id", table_name="project_files")
    op.drop_index("ix_project_files_project_id", table_name="project_files")
    op.drop_table("project_files")

    op.drop_index("ix_project_notes_created_at", table_name="project_notes")
    op.drop_index("ix_project_notes_created_by_admin_id", table_name="project_notes")
    op.drop_index("ix_project_notes_project_id", table_name="project_notes")
    op.drop_table("project_notes")

    op.drop_index("ix_projects_updated_at", table_name="projects")
    op.drop_index("ix_projects_created_at", table_name="projects")
    op.drop_index("ix_projects_created_by_admin_id", table_name="projects")
    op.drop_index("ix_projects_lead_id", table_name="projects")
    op.drop_table("projects")
