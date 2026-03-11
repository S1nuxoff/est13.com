"""explicit end flags for questions/options

Revision ID: 0012_end_flags
Revises: 0011_service_start
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0012_end_flags"
down_revision = "0011_service_start"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column("ends_flow", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("questions", "ends_flow", server_default=None)

    op.add_column(
        "question_options",
        sa.Column("ends_flow", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("question_options", "ends_flow", server_default=None)


def downgrade() -> None:
    op.drop_column("question_options", "ends_flow")
    op.drop_column("questions", "ends_flow")
