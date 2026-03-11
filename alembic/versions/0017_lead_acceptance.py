"""lead acceptance tracking

Revision ID: 0017_lead_acceptance
Revises: 0016_support_admin_tracking
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0017_lead_acceptance"
down_revision = "0016_support_admin_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("leads", sa.Column("accepted_by_admin_id", sa.Integer(), nullable=True))

    op.create_index("ix_leads_accepted_at", "leads", ["accepted_at"], unique=False)
    op.create_index("ix_leads_accepted_by_admin_id", "leads", ["accepted_by_admin_id"], unique=False)
    op.create_foreign_key(
        "fk_leads_accepted_by_admin_id_admin_accounts",
        "leads",
        "admin_accounts",
        ["accepted_by_admin_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_leads_accepted_by_admin_id_admin_accounts", "leads", type_="foreignkey")
    op.drop_index("ix_leads_accepted_by_admin_id", table_name="leads")
    op.drop_index("ix_leads_accepted_at", table_name="leads")
    op.drop_column("leads", "accepted_by_admin_id")
    op.drop_column("leads", "accepted_at")

