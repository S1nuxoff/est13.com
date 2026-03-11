"""lead status overhaul + lead events

Revision ID: 0018_lead_statuses_events
Revises: 0017_lead_acceptance
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "0018_lead_statuses_events"
down_revision = "0017_lead_acceptance"
branch_labels = None
depends_on = None


NEW_STATUSES = (
    "filling",
    "abandoned",
    "awaiting_review",
    "in_review",
    "confirmed",
    "in_work",
    "paused",
    "rejected",
    "lost",
    "studio_cancelled",
    "done",
    "delivered",
    "closed",
)


def upgrade() -> None:
    # Replace enum values by creating a new type and swapping the column.
    op.execute("CREATE TYPE lead_status_new AS ENUM (" + ", ".join(f"'{v}'" for v in NEW_STATUSES) + ")")

    op.add_column(
        "leads",
        sa.Column("status_new", sa.Enum(*NEW_STATUSES, name="lead_status_new"), nullable=False, server_default="filling"),
    )

    # Map old values to new.
    op.execute(
        """
        UPDATE leads
        SET status_new = CASE status::text
            WHEN 'in_progress' THEN 'filling'::lead_status_new
            WHEN 'submitted' THEN 'awaiting_review'::lead_status_new
            WHEN 'cancelled' THEN 'abandoned'::lead_status_new
            WHEN 'review' THEN 'in_review'::lead_status_new
            WHEN 'contacted' THEN 'confirmed'::lead_status_new
            WHEN 'in_work' THEN 'in_work'::lead_status_new
            WHEN 'done' THEN 'done'::lead_status_new
            WHEN 'lost' THEN 'lost'::lead_status_new
            ELSE 'filling'::lead_status_new
        END
        """
    )

    op.alter_column("leads", "status_new", server_default=None)
    op.drop_column("leads", "status")
    op.execute("ALTER TABLE leads RENAME COLUMN status_new TO status")

    # Drop old enum type and rename the new one to keep name stable for SQLAlchemy.
    op.execute("DROP TYPE lead_status")
    op.execute("ALTER TYPE lead_status_new RENAME TO lead_status")

    # Lead events (status timeline).
    # IMPORTANT: lead_status type already exists at this point, so we must NOT try to create it again.
    op.create_table(
        "lead_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", pg.ENUM(*NEW_STATUSES, name="lead_status", create_type=False), nullable=True),
        sa.Column("to_status", pg.ENUM(*NEW_STATUSES, name="lead_status", create_type=False), nullable=False),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admin_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_lead_events_lead_id", "lead_events", ["lead_id"], unique=False)
    op.create_index("ix_lead_events_admin_id", "lead_events", ["admin_id"], unique=False)
    op.create_index("ix_lead_events_created_at", "lead_events", ["created_at"], unique=False)
    op.create_index("ix_lead_events_to_status", "lead_events", ["to_status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_lead_events_to_status", table_name="lead_events")
    op.drop_index("ix_lead_events_created_at", table_name="lead_events")
    op.drop_index("ix_lead_events_admin_id", table_name="lead_events")
    op.drop_index("ix_lead_events_lead_id", table_name="lead_events")
    op.drop_table("lead_events")

    old_statuses = (
        "in_progress",
        "submitted",
        "cancelled",
        "review",
        "contacted",
        "in_work",
        "done",
        "lost",
    )
    op.execute("CREATE TYPE lead_status_old AS ENUM (" + ", ".join(f"'{v}'" for v in old_statuses) + ")")

    op.add_column(
        "leads",
        sa.Column("status_old", sa.Enum(*old_statuses, name="lead_status_old"), nullable=False, server_default="in_progress"),
    )
    op.execute(
        """
        UPDATE leads
        SET status_old = CASE status::text
            WHEN 'filling' THEN 'in_progress'::lead_status_old
            WHEN 'awaiting_review' THEN 'submitted'::lead_status_old
            WHEN 'in_review' THEN 'review'::lead_status_old
            WHEN 'confirmed' THEN 'contacted'::lead_status_old
            WHEN 'in_work' THEN 'in_work'::lead_status_old
            WHEN 'done' THEN 'done'::lead_status_old
            WHEN 'lost' THEN 'lost'::lead_status_old
            WHEN 'abandoned' THEN 'cancelled'::lead_status_old
            ELSE 'in_progress'::lead_status_old
        END
        """
    )
    op.alter_column("leads", "status_old", server_default=None)
    op.drop_column("leads", "status")
    op.execute("ALTER TABLE leads RENAME COLUMN status_old TO status")

    op.execute("DROP TYPE lead_status")
    op.execute("ALTER TYPE lead_status_old RENAME TO lead_status")
