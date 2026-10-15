#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

ENV_FILE="$ROOT/.env/.env.develop"
ENV_EXAMPLE="$ROOT/.env/.env.develop.example"
ENV_LINK="$ROOT/.docker/.env"

# env file
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

# symlink
ln -sfn "../.env/.env.develop" "$ENV_LINK"
