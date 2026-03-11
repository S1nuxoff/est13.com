"""question node positions

Revision ID: 0003_question_positions
Revises: 0002_leads_and_content
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_question_positions"
down_revision = "0002_leads_and_content"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("pos_x", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("questions", sa.Column("pos_y", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("questions", "pos_x", server_default=None)
    op.alter_column("questions", "pos_y", server_default=None)


def downgrade() -> None:
    op.drop_column("questions", "pos_y")
    op.drop_column("questions", "pos_x")

