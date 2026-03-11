"""bot texts: optional photo

Revision ID: 0013_bot_text_photos
Revises: 0012_end_flags
Create Date: 2026-02-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0013_bot_text_photos"
down_revision = "0012_end_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bot_texts", sa.Column("photo_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("bot_texts", "photo_path")

