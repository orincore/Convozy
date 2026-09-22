# Convozy

Instagram comment-to-DM automation — the free/low-cost alternative to
ManyChat-style tools, with AI features built in.

**Start here:**
- [`CLAUDE.md`](./CLAUDE.md) — project rules (read before writing any code)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — full system design
- [`TRACKER.md`](./TRACKER.md) — what's done, what's next, open questions

## Stack

Node.js/TypeScript (NestJS, modular monolith) · PostgreSQL + Prisma ·
Redis + BullMQ · Next.js (App Router) · Stripe + Razorpay · Docker Compose on
a self-hosted VPS. Full rationale in `TRACKER.md`'s Decisions log.

## Monorepo layout

```
apps/
  api/       NestJS API + worker (modular monolith — see main.ts / worker.ts)
  web/       Next.js marketing site (SEO-critical) + dashboard app
packages/
  shared/    Types/constants shared between api and web
infra/
  docker/    Dockerfiles for api, worker, web
  nginx/     Reverse proxy config
  scripts/   setup.sh (local dev), deploy.sh (production VPS)
docs/
  decisions/ ADRs for significant architecture decisions
  runbooks/  Operational runbooks (DLQ growth, account throttled, etc.)
```

## Local development

Prerequisites: Node.js 20+, pnpm 9+, Docker.

```bash
./infra/scripts/setup.sh   # copies .env.example -> .env, installs deps,
                            # starts Postgres/Redis, runs Prisma migrations
pnpm dev                    # runs api + worker + web in watch mode
```

Then fill in the real values in `.env` (Meta app credentials, Stripe/Razorpay
keys, etc. — see `.env.example` for what's required and `TRACKER.md`'s open
questions for what's still outstanding).

API: `http://localhost:3000/api` · Health: `http://localhost:3000/api/health/ready`
Web: `http://localhost:3001`

## Running everything in Docker

```bash
pnpm docker:dev    # dev compose: postgres, redis, api, worker, web, nginx
```

## Production deploy

Sized for the current Hostinger KVM 2 VPS (2 vCPU/8GB RAM) — see
`docker-compose.prod.yml` and `TRACKER.md`'s Decisions log.

```bash
./infra/scripts/deploy.sh
```

## Contributing rules

Every module follows the same shape (`*.module.ts`, `*.controller.ts`,
`*.service.ts`, `dto/`, `*.spec.ts`) and the boundaries in `CLAUDE.md` §3.
Read `CLAUDE.md` in full before adding a module, changing the data model, or
touching security/billing/AI code paths — it covers OWASP Top 10 compliance
(§5a), SEO requirements for any frontend work (§11), and the UI design
standard (§12, `taste-skill`) as non-negotiable rules, not suggestions.
