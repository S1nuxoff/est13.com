"""lead source (bot vs webapp)

Revision ID: 0021_lead_source
Revises: 0020_projects
Create Date: 2026-02-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0021_lead_source"
down_revision = "0020_projects"
branch_labels = None
depends_on = None


def upgrade() -> None:
    lead_source = sa.Enum("bot", "webapp", name="lead_source")
    bind = op.get_bind()
    lead_source.create(bind, checkfirst=True)

    op.add_column(
        "leads",
        sa.Column("source", lead_source, nullable=False, server_default="bot"),
    )
    op.create_index("ix_leads_source", "leads", ["source"])

    # Keep default for future inserts as well (explicitly managed in code too).


def downgrade() -> None:
    op.drop_index("ix_leads_source", table_name="leads")
    op.drop_column("leads", "source")

    bind = op.get_bind()
    sa.Enum(name="lead_source").drop(bind, checkfirst=True)

