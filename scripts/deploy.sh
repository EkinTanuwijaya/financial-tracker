#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Deployment overwrites the configuration in /opt/finance-tracker/app.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
: "${IMAGE_PREFIX:?Set IMAGE_PREFIX}"
: "${IMAGE_TAG:?Set IMAGE_TAG}"
root=/opt/finance-tracker
test -f "$root/.env.production"
test -s "$root/tls/fullchain.pem" && test -s "$root/tls/privkey.pem" || {
  echo 'Missing Nginx TLS certificate or key; see docs/deployment.md.' >&2
  exit 1
}
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
printf 'IMAGE_PREFIX=%s\nIMAGE_TAG=%s\n' "$IMAGE_PREFIX" "$IMAGE_TAG" > .env
compose=(docker compose --env-file "$root/.env.production" --env-file .env -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull
"${compose[@]}" run --rm --no-deps nginx nginx -t
"${compose[@]}" up -d --wait --wait-timeout 120 postgres redis

mkdir -p "$root/backups"
backup="$root/backups/$(date -u +%Y%m%dT%H%M%SZ)-${IMAGE_TAG}.sql.gz"
"${compose[@]}" exec -T postgres pg_dump -U finance -d finance_tracker | gzip > "$backup"
echo "Database backup: $backup"

# Only committed migrations run in production; never use db push or migrate dev.
"${compose[@]}" run --rm --no-deps backend \
  pnpm --filter @finance-tracker/backend exec prisma migrate deploy \
  --schema=../../packages/prisma/schema.prisma
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 900
# The config mount path stays the same, so apply overwritten Nginx settings.
"${compose[@]}" exec -T nginx nginx -s reload
"${compose[@]}" ps
printf 'Deployed %s\n' "$IMAGE_TAG"
