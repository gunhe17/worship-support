#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

# stop
if pkill -f "$ROOT/worship_support/uni/node_modules/.bin/expo start"; then
  echo "expo stopped"
else
  echo "expo not running"
fi
