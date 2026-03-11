"""user profile + chat messages

Revision ID: 0005_user_chat
Revises: 0004_archive_flags
Create Date: 2026-02-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0005_user_chat"
down_revision = "0004_archive_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make column/index creation idempotent (DB may have partial changes from previous attempts).
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code VARCHAR(16);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_chat_id BIGINT;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_file_id VARCHAR(256);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_file_unique_id VARCHAR(128);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS support_enabled BOOLEAN NOT NULL DEFAULT false;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_support_enabled ON users (support_enabled);")

    # Make enum creation idempotent (some DBs may already have it from partial runs/manual changes).
    op.execute(
        """
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
        CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
    END IF;
END$$;
"""
    )
    message_direction = postgresql.ENUM("inbound", "outbound", name="message_direction", create_type=False)

    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("chat_messages"):
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("direction", message_direction, nullable=False),
            sa.Column("text", sa.Text(), nullable=False, server_default=""),
            sa.Column("tg_message_id", sa.Integer(), nullable=True),
            sa.Column("admin_tg_id", sa.BigInteger(), nullable=True),
            sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    # Index creation should also be idempotent.
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_user_id ON chat_messages (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_created_at ON chat_messages (created_at);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_direction ON chat_messages (direction);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_direction;")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_user_id;")
    op.execute("DROP TABLE IF EXISTS chat_messages;")

    op.execute("DROP INDEX IF EXISTS ix_users_support_enabled;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS support_enabled;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS photo_file_unique_id;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS photo_file_id;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_chat_id;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS language_code;")

    op.execute("DROP TYPE IF EXISTS message_direction;")

