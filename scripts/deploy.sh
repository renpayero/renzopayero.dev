#!/bin/sh
# Despliega el último commit en el VPS, en una sola conexión SSH.
# Sube exactamente lo que está en git: nada de archivos locales sueltos.
#   sh scripts/deploy.sh
set -eu

HOST="${DEPLOY_HOST:-vpsren}"
DIR=/root/projects/renzopayero
SITE_URL="${SITE_URL:-https://renzopayero.dev}"
COMMITS="$(git rev-list --count HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin commit: se desplegaría otra cosa de la que ves." >&2
  exit 1
fi

# Sin conversión de fin de línea: en Windows, git archive entregaría CRLF.
git -c core.autocrlf=false archive --format=tar HEAD | ssh "$HOST" "
  set -eu
  rm -rf $DIR.new
  mkdir -p $DIR.new
  tar -x -C $DIR.new
  rm -rf $DIR.old
  if [ -d $DIR ]; then mv $DIR $DIR.old; fi
  mv $DIR.new $DIR
  cd $DIR
  SITE_URL='$SITE_URL' BUILD_COMMITS='$COMMITS' docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
  rm -rf $DIR.old
  docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --format '{{.Name}} {{.Status}}'
"
