#!/usr/bin/env bash
# Production deploy on the VPS. Run from the repo root on the server:
# ./infra/scripts/deploy.sh
#
# Prerequisites (see TRACKER.md Phase 9):
#  - .env populated with production secrets (never copy dev secrets)
#  - infra/nginx/certs/ populated with TLS certs (e.g. via certbot)
#  - DNS pointed at this server
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example, fill in production values, and re-run." >&2
  exit 1
fi

echo "Pulling latest code..."
git pull --ff-only

echo "Building and starting production containers..."
# --scale worker=2: sized for the current Hostinger KVM 2 VPS (2 vCPU/8GB RAM)
# — see docker-compose.prod.yml and TRACKER.md Decisions log. Raise this (and
# the resource caps in docker-compose.prod.yml) if the VPS is upgraded.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --scale worker=2

echo "Running database migrations..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T api \
  node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

echo "Deploy complete. Checking health..."
sleep 3
curl -fsS http://localhost/api/health/ready || {
  echo "Health check failed — check logs with: docker compose logs -f api worker" >&2
  exit 1
}

echo "Deployed successfully."
