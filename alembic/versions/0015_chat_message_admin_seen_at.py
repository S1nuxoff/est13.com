"""chat messages: admin seen marker for inbound

Revision ID: 0015_chat_message_admin_seen_at
Revises: 0014_chat_message_seen_at
Create Date: 2026-02-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0015_chat_message_admin_seen_at"
down_revision = "0014_chat_message_seen_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("admin_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "admin_seen_at")

