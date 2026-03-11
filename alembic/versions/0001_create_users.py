"""create users table

Revision ID: 0001_create_users
Revises:
Create Date: 2026-02-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_create_users"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("tg_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column("first_name", sa.String(length=128), nullable=True),
        sa.Column("last_name", sa.String(length=128), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_users_tg_id"), "users", ["tg_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_tg_id"), table_name="users")
    op.drop_table("users")

