#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

ENV="$ROOT/.env/.env.develop"

set -a
. "$ENV"
set +a

# drop
PGPASSWORD="$DEVELOP_POSTGRES_PASSWORD" psql \
  -h "$DEVELOP_POSTGRES_HOST" \
  -p "$DEVELOP_POSTGRES_CONTAINER_PORT" \
  -U "$DEVELOP_POSTGRES_USER" \
  -d "$DEVELOP_POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
