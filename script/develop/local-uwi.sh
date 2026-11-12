#!/bin/sh
set -eu
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/worship_support/uwi"
npm run build
exec npx next start -H 0.0.0.0 -p 28301
