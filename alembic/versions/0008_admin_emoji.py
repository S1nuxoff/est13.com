"""admin emoji avatar

Revision ID: 0008_admin_emoji
Revises: 0007_admin_auth
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op


revision = "0008_admin_emoji"
down_revision = "0007_admin_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS avatar_emoji VARCHAR(16) NULL;")


def downgrade() -> None:
    op.execute("ALTER TABLE admin_accounts DROP COLUMN IF EXISTS avatar_emoji;")

