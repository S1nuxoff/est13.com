"""track lead current question

Revision ID: 0006_lead_stage
Revises: 0005_user_chat
Create Date: 2026-02-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0006_lead_stage"
down_revision = "0005_user_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent: DB may already have partial changes.
    op.execute(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_question_id INTEGER NULL;"
    )
    op.execute(
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'leads_current_question_id_fkey'
    ) THEN
        ALTER TABLE leads
        ADD CONSTRAINT leads_current_question_id_fkey
        FOREIGN KEY (current_question_id) REFERENCES questions(id) ON DELETE SET NULL;
    END IF;
END$$;
"""
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_leads_current_question_id ON leads (current_question_id);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_leads_current_question_id;")
    op.execute("ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_current_question_id_fkey;")
    op.execute("ALTER TABLE leads DROP COLUMN IF EXISTS current_question_id;")

