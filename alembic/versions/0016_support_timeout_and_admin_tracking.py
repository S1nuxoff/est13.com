"""support timeout + admin tracking

Revision ID: 0016_support_admin_tracking
Revises: 0015_chat_message_admin_seen_at
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0016_support_admin_tracking"
down_revision = "0015_chat_message_admin_seen_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("support_enabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("support_enabled_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("support_admin_id", sa.Integer(), nullable=True))

    op.create_index("ix_users_support_enabled_until", "users", ["support_enabled_until"], unique=False)
    op.create_index("ix_users_support_admin_id", "users", ["support_admin_id"], unique=False)
    op.create_foreign_key(
        "fk_users_support_admin_id_admin_accounts",
        "users",
        "admin_accounts",
        ["support_admin_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("chat_messages", sa.Column("admin_id", sa.Integer(), nullable=True))
    op.create_index("ix_chat_messages_admin_id", "chat_messages", ["admin_id"], unique=False)
    op.create_foreign_key(
        "fk_chat_messages_admin_id_admin_accounts",
        "chat_messages",
        "admin_accounts",
        ["admin_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_chat_messages_admin_id_admin_accounts", "chat_messages", type_="foreignkey")
    op.drop_index("ix_chat_messages_admin_id", table_name="chat_messages")
    op.drop_column("chat_messages", "admin_id")

    op.drop_constraint("fk_users_support_admin_id_admin_accounts", "users", type_="foreignkey")
    op.drop_index("ix_users_support_admin_id", table_name="users")
    op.drop_index("ix_users_support_enabled_until", table_name="users")
    op.drop_column("users", "support_admin_id")
    op.drop_column("users", "support_enabled_until")
    op.drop_column("users", "support_enabled_at")
