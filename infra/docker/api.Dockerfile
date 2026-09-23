# API entrypoint (main.ts). See worker.Dockerfile for the worker process —
# same image build, different CMD, so they never drift apart.
FROM node:20-slim AS base
# Installed here too, not just in runtime: `prisma generate` (below) probes
# the local openssl version to pick the right query-engine binary target.
# Without it here, it silently picks a stale default (debian-openssl-1.1.x)
# that doesn't match the runtime image's actual openssl (3.0.x), and the
# generated client fails to load at startup — found the hard way on first
# real deploy (see TRACKER.md Phase 9).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter=@convozy/shared build
RUN pnpm --filter=@convozy/api prisma:generate
RUN pnpm --filter=@convozy/api build

FROM node:20-slim AS runtime
# Prisma's query engine needs libssl at runtime; node:20-slim doesn't ship
# it, so the container boots then immediately fails with a Prisma
# "failed to detect the libssl/openssl version" error — found the hard way
# on first real deploy (see TRACKER.md Phase 9). Prisma's own error message
# names this exact fix.
#
# ffmpeg: MediaService shells out to it (audio-normalizer.ts) to re-encode
# every audio upload into a faststart AAC/m4a before it reaches R2 — a raw
# Apple Voice Memos export fails Meta's Send API ingest otherwise. Only the
# API process handles uploads (POST /media/upload), so this doesn't need to
# be in worker.Dockerfile.
RUN apt-get update -y && apt-get install -y openssl ffmpeg && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/shared ./packages/shared

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
