"""admin super flag

Revision ID: 0022_admin_super
Revises: 0021_lead_source
Create Date: 2026-02-10
"""

from __future__ import annotations

from alembic import op


revision = "0022_admin_super"
down_revision = "0021_lead_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS is_super BOOLEAN NOT NULL DEFAULT FALSE;"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_accounts_is_super ON admin_accounts (is_super);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_admin_accounts_is_super;")
    op.execute("ALTER TABLE admin_accounts DROP COLUMN IF EXISTS is_super;")
