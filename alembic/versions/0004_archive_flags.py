"""archive flags for questions/options

Revision ID: 0004_archive_flags
Revises: 0003_question_positions
Create Date: 2026-02-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_archive_flags"
down_revision = "0003_question_positions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(op.f("ix_questions_is_archived"), "questions", ["is_archived"], unique=False)
    op.alter_column("questions", "is_archived", server_default=None)

    op.add_column(
        "question_options",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(op.f("ix_question_options_is_archived"), "question_options", ["is_archived"], unique=False)
    op.alter_column("question_options", "is_archived", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_question_options_is_archived"), table_name="question_options")
    op.drop_column("question_options", "is_archived")

    op.drop_index(op.f("ix_questions_is_archived"), table_name="questions")
    op.drop_column("questions", "is_archived")

