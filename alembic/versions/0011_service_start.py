"""service start question pointer

Revision ID: 0011_service_start
Revises: 0010_q_media_layout
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0011_service_start"
down_revision = "0010_q_media_layout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("services", sa.Column("start_question_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_services_start_question_id_questions",
        "services",
        "questions",
        ["start_question_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_services_start_question_id_questions", "services", type_="foreignkey")
    op.drop_column("services", "start_question_id")
