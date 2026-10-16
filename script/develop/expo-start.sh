#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

ENV="$ROOT/.env/.env.develop"

# env file
if [ ! -f "$ENV" ]; then
  sh "$ROOT/script/develop/devcontainer-initialize.sh"
fi

set -a
. "$ENV"
set +a

# api url
# 앱은 폰에서 돌아서 localhost가 아니라 맥의 LAN IP로 api에 닿는다
HOST="$(ipconfig getifaddr en0 || ipconfig getifaddr en1)"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://$HOST:$DEVELOP_API_PORT}"

# run
cd "$ROOT/worship_support/uni"
npm install
npx expo start
