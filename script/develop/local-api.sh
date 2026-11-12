#!/bin/sh
set -eu
ROOT="$(git rev-parse --show-toplevel)"
. "$ROOT/script/develop/local-env.sh"
cd "$ROOT"
.venv/bin/python -m worship_support.api.infrastructure.database.postgresql.migration.migrate
exec .venv/bin/python -m worship_support.api.bin.server
