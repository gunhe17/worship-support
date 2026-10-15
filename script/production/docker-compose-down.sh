#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

ENV="$ROOT/.env/.env.production"
DOCKER="$ROOT/.docker/docker-compose.production.yml"

docker compose \
  --env-file "$ENV" \
  -f "$DOCKER" \
  down
