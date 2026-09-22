#!/usr/bin/env bash
# Production deploy on the VPS. Run from the repo root on the server:
# ./infra/scripts/deploy.sh
#
# Prerequisites (see TRACKER.md Phase 9):
#  - .env populated with production secrets (never copy dev secrets)
#  - docker-compose.vps.yml present if this box needs the shared-VPS nginx
#    port override (deliberately not committed — see its own header comment;
#    this script includes it automatically when present, skips it otherwise
#    so the same script still works on a box that doesn't need it)
#  - DNS pointed at this server, TLS terminated by whatever nginx fronts it
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example, fill in production values, and re-run." >&2
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
if [ -f docker-compose.vps.yml ]; then
  COMPOSE_FILES+=(-f docker-compose.vps.yml)
fi

echo "Checking for local drift before pulling..."
# Only the VPS-specific, deliberately-uncommitted override files are expected
# to show up as untracked here. Anything else (a modified tracked file, or an
# untracked file this script doesn't know about) means something changed on
# this box outside of git — investigate before blindly overwriting it.
UNEXPECTED=$(git status --porcelain | grep -vE '^\?\? (docker-compose\.vps\.yml|web\.Dockerfile)$' || true)
if [ -n "$UNEXPECTED" ]; then
  echo "Refusing to deploy: unexpected local changes on this server." >&2
  echo "$UNEXPECTED" >&2
  echo "Investigate (git diff / git status) before running this script again." >&2
  exit 1
fi

echo "Fetching and merging latest code (fast-forward only, never force)..."
git fetch origin
BEFORE=$(git rev-parse HEAD)
git merge origin/main --ff-only
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "Already up to date at $AFTER — nothing to deploy."
  exit 0
fi

echo "Updated $BEFORE -> $AFTER:"
git log --oneline "$BEFORE..$AFTER"

echo "Building images (api, worker, web)..."
docker compose "${COMPOSE_FILES[@]}" build api worker web

echo "Running database migrations (idempotent — only applies pending ones)..."
docker compose "${COMPOSE_FILES[@]}" up -d api
docker compose "${COMPOSE_FILES[@]}" exec -T api npx prisma migrate deploy

echo "Starting api, worker, web..."
docker compose "${COMPOSE_FILES[@]}" up -d api worker web

echo "Deploy complete. Checking health..."
sleep 5
curl -fsS https://api.convozy.orincore.com/health || {
  echo "Health check failed — check logs with: docker compose ${COMPOSE_FILES[*]} logs --tail=50 api worker" >&2
  exit 1
}

echo "Deployed successfully ($BEFORE -> $AFTER)."
