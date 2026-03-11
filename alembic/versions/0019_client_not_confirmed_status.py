"""add client_not_confirmed lead status

Revision ID: 0019_client_not_confirmed
Revises: 0018_lead_statuses_events
Create Date: 2026-02-05
"""

from alembic import op


revision = "0019_client_not_confirmed"
down_revision = "0018_lead_statuses_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add a new enum value safely (idempotent).
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'lead_status'
              AND e.enumlabel = 'client_not_confirmed'
          ) THEN
            ALTER TYPE lead_status ADD VALUE 'client_not_confirmed';
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Postgres enums cannot drop values easily; keep as-is.
    pass

