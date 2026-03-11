"""admin accounts + sessions

Revision ID: 0007_admin_auth
Revises: 0006_lead_stage
Create Date: 2026-02-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0007_admin_auth"
down_revision = "0006_lead_stage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Admin accounts
    op.execute(
        """
CREATE TABLE IF NOT EXISTS admin_accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NULL
);
"""
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_accounts_username ON admin_accounts (username);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_accounts_is_active ON admin_accounts (is_active);")

    # Sessions
    op.execute(
        """
CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
    token VARCHAR(96) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
"""
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_sessions_token ON admin_sessions (token);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_sessions_admin_id ON admin_sessions (admin_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_sessions_expires_at ON admin_sessions (expires_at);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admin_sessions;")
    op.execute("DROP TABLE IF EXISTS admin_accounts;")

