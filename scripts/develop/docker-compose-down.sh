#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

ENV="$ROOT/.env/.env.develop"
DOCKER="$ROOT/.docker/docker-compose.develop.yml"

docker compose \
  --env-file "$ENV" \
  -f "$DOCKER" \
  down
