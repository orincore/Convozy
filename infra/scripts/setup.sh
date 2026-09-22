#!/usr/bin/env bash
# One-time local dev setup. Run from the repo root: ./infra/scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  echo "Creating .env from .env.example — fill in real values before running the app."
  cp .env.example .env
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install it first: https://pnpm.io/installation" >&2
  exit 1
fi

echo "Installing dependencies..."
pnpm install

echo "Starting Postgres + Redis..."
docker compose up -d postgres redis

echo "Waiting for Postgres to be healthy..."
until docker compose ps postgres | grep -q "healthy"; do
  sleep 1
done

echo "Generating Prisma client and running migrations..."
pnpm --filter=@convozy/api prisma:generate
pnpm --filter=@convozy/api prisma:migrate:dev

echo "Setup complete. Run 'pnpm dev' to start the API, worker, and web app."
