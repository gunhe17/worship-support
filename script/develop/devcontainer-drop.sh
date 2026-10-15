#!/bin/sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"

ENV="$ROOT/.env/.env.develop"

set -a
. "$ENV"
set +a

# drop
# 사용자 권한은 DB 이름 기준이라 재생성 후에도 유지된다. 테이블은 api 재기동 시 재생성
mysql \
  -h "$DEVELOP_MYSQL_HOST" \
  -P "$DEVELOP_MYSQL_CONTAINER_PORT" \
  -u root \
  -p"$DEVELOP_MYSQL_ROOT_PASSWORD" \
  -e "DROP DATABASE IF EXISTS \`$DEVELOP_MYSQL_DATABASE\`; CREATE DATABASE \`$DEVELOP_MYSQL_DATABASE\`;"
