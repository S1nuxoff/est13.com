"""chat messages: mark outbound as seen

Revision ID: 0014_chat_message_seen_at
Revises: 0013_bot_text_photos
Create Date: 2026-02-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0014_chat_message_seen_at"
down_revision = "0013_bot_text_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "seen_at")

