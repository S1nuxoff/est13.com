"""extend lead statuses

Revision ID: 0009_lead_status_more
Revises: 0008_admin_emoji
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op


revision = "0009_lead_status_more"
down_revision = "0008_admin_emoji"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enum: add values in a safe idempotent way.
    for value in ["review", "contacted", "in_work", "done", "lost"]:
        op.execute(
            f"""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'lead_status'
          AND e.enumlabel = '{value}'
    ) THEN
        ALTER TYPE lead_status ADD VALUE '{value}';
    END IF;
END$$;
"""
        )


def downgrade() -> None:
    # Enum values cannot be removed safely in PostgreSQL without complex operations.
    pass

