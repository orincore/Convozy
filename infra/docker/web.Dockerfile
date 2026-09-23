# Next.js dashboard + SEO-optimized marketing site (see apps/web).
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
# NEXT_PUBLIC_* vars are inlined into the JS bundle at build time (Next.js
# does a literal string replacement during `next build`), not read at
# container runtime — a runtime `environment:`/.env override can't change
# it after the fact once it's baked into a static chunk. Must come in as a
# build ARG, not an env var on the running container. Found the hard way:
# the API base URL was silently stuck on its localhost fallback through
# several redeploys before this was traced (see TRACKER.md Phase 9).
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
# Public site origin: baked into canonical/OG/sitemap URLs at build time.
ARG NEXT_PUBLIC_APP_BASE_URL
ENV NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL
COPY . .
RUN pnpm --filter=@convozy/shared build
RUN pnpm --filter=@convozy/web build

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web ./apps/web
COPY --from=build /repo/packages/shared ./packages/shared

WORKDIR /repo/apps/web
EXPOSE 3001
# Call next directly instead of `pnpm start`: the runtime stage never runs
# `pnpm install` (only node_modules is copied over), so corepack has no
# local pnpm version to fall back on and tries to fetch one from the npm
# registry at container startup — an unnecessary network dependency for a
# container that's already fully built. Found the hard way on first real
# deploy (see TRACKER.md Phase 9).
CMD ["node_modules/.bin/next", "start", "-p", "3001"]
