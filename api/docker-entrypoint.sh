#!/usr/bin/env sh
set -eu

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Running Alembic migrations..."
  python -m alembic upgrade head
fi

exec "$@"
