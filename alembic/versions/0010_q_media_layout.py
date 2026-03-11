"""question photos + option keyboard layout + photo answers

Revision ID: 0010_q_media_layout
Revises: 0009_lead_status_more
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0010_q_media_layout"
down_revision = "0009_lead_status_more"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("photo_path", sa.Text(), nullable=True))

    op.add_column(
        "question_options",
        sa.Column("keyboard_row", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "question_options",
        sa.Column("keyboard_col", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("question_options", "keyboard_row", server_default=None)
    op.alter_column("question_options", "keyboard_col", server_default=None)

    op.add_column("lead_answers", sa.Column("photo_file_id", sa.String(length=256), nullable=True))
    op.add_column(
        "lead_answers",
        sa.Column("photo_file_unique_id", sa.String(length=256), nullable=True),
    )
    op.add_column("lead_answers", sa.Column("photo_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lead_answers", "photo_path")
    op.drop_column("lead_answers", "photo_file_unique_id")
    op.drop_column("lead_answers", "photo_file_id")
    op.drop_column("question_options", "keyboard_col")
    op.drop_column("question_options", "keyboard_row")
    op.drop_column("questions", "photo_path")
