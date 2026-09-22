# Worker entrypoint (worker.ts) — same build as api.Dockerfile, different
# CMD. Scale by running more replicas of this image (ARCHITECTURE.md §5).
FROM node:20-slim AS base
# See api.Dockerfile for why this needs to be here too, not just runtime.
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
# it — see api.Dockerfile for the same fix and why.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/shared ./packages/shared

WORKDIR /repo/apps/api
CMD ["node", "dist/worker.js"]
