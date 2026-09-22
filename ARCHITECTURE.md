# ARCHITECTURE.md — Convozy System Design

Read this after `CLAUDE.md`. This document describes *how* the system is built;
`CLAUDE.md` describes the rules for building it. If they ever conflict, `CLAUDE.md`
wins and this document should be corrected.

---

## 1. Product flow (the core loop)

```
Creator posts a Reel: "Comment PRICE and I'll DM you the link"
        │
        ▼
Viewer comments "PRICE" on the Reel
        │
        ▼
Meta sends a webhook event to Convozy (comments/mentions webhook)
        │
        ▼
API verifies the webhook signature, dedups by event ID, enqueues a job
        │
        ▼
Worker picks up the job → loads the creator's active automations for that
post/account → matches the comment text against trigger rules (exact / contains /
regex / AI intent)
        │
        ▼
Match found → Automation defines actions:
   1. optional public comment reply ("Sent! Check your DMs 📩")
   2. private reply / DM with the configured message (text, link, button, or
      AI-generated response)
        │
        ▼
Messaging module sends via Graph API, respecting per-account rate limits,
records the send in MessageLog, updates usage counters for billing
        │
        ▼
Dashboard shows the event in real time; creator sees delivery status
```

Everything downstream of "webhook received" is asynchronous. The webhook HTTP
response to Meta must return fast (Meta expects a 200 within a few seconds) — the
API's only job in that request is: verify signature → dedup check → enqueue → return
200. All matching/sending happens in workers.

---

## 2. High-level component diagram

```
                                   ┌────────────────────┐
                                   │   Meta / Instagram   │
                                   │  Graph API + Webhooks│
                                   └─────────┬────────────┘
                                             │ webhooks (comments, DMs, mentions)
                                             │ outbound Graph API calls
                                             ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                        Nginx (TLS, reverse proxy)               │
        └───────────────┬───────────────────────────────┬───────────────┘
                         │                               │
                         ▼                               ▼
              ┌────────────────────┐          ┌────────────────────────┐
              │   apps/web (Next)   │          │     apps/api (NestJS)   │
              │  marketing (SSR/SEO)│          │  HTTP API + webhook rx  │
              │  + dashboard (SPA)  │          │  (thin, fast, stateless)│
              └─────────┬──────────┘          └───────────┬────────────┘
                        │  REST/JSON                       │ enqueue jobs
                        └──────────────┬────────────────────┘
                                       ▼
                          ┌─────────────────────────┐
                          │   Redis (BullMQ queues)  │
                          │  webhook-events           │
                          │  automation-match         │
                          │  message-send             │
                          │  ai-processing             │
                          │  billing-events            │
                          └─────────────┬─────────────┘
                                        ▼
                          ┌─────────────────────────┐
                          │  apps/api worker process  │
                          │  (same codebase, worker    │
                          │   entrypoint, N replicas)  │
                          └─────────────┬─────────────┘
                                        ▼
                          ┌─────────────────────────┐
                          │   PostgreSQL (Prisma)     │
                          └─────────────────────────┘
```

All of `apps/api` (HTTP API + worker) is one NestJS codebase with two entrypoints
(`main.ts`, `worker.ts`) sharing the same modules — a modular monolith, not two
separate services to maintain. This is deliberate: it's the cheapest thing that can
scale via horizontal worker replicas, per §5 below, and can be split into real
microservices later if a single module (e.g. `messaging`) outgrows the monolith.

---

## 3. Domain modules (`apps/api/src/modules`)

| Module | Owns | Notes |
|---|---|---|
| `auth` | Creator accounts, sessions/JWT, OAuth login | Email/password + optional Google login for dashboard access |
| `users` | User/workspace profile, team members (future) | |
| `instagram` | Instagram Business Account connection via Meta OAuth, encrypted long-lived token storage, token refresh | One creator can connect multiple IG accounts |
| `webhooks` | Meta webhook receiver + signature verification + dedup + enqueue | Deliberately thin — no business logic |
| `automations` | Automation rules (trigger + conditions + actions), matching engine | The product's core logic |
| `messaging` | All outbound Graph API calls: private replies, DMs, comment replies; per-account rate limiter, retry/backoff, circuit breaker | Only module allowed to call Graph API for sends |
| `ai` | Provider-agnostic AI interface: intent classification, AI-drafted replies, smart FAQ | Async only, never inline in the webhook path |
| `billing` | Plans, subscriptions, usage metering, Stripe + Razorpay via `PaymentProvider` interface | Single source of truth for "can this account send more this month" |
| `analytics` | Event/delivery stats for the dashboard | Read-mostly, aggregates from `MessageLog`/`CommentEvent` |
| `admin` | Internal ops: account lookup, manual overrides, audit log viewing | Guarded by an admin role |
| `notifications` | Email/in-app notices (send failures, plan limits, billing events) | |
| `health` | `/health`, `/health/ready` | Checks DB + Redis connectivity, not just process liveness |

Cross-module rule (see `CLAUDE.md` §3): a module calls another module's exported
service methods, never its Prisma models directly.

---

## 4. Data model (see `apps/api/prisma/schema.prisma` for the authoritative source)

Core entities:

- **User** — a creator/customer account (login identity).
- **Workspace** — billing + team boundary; a User belongs to a Workspace (1:1 to
  start, extensible to teams later).
- **InstagramAccount** — a connected IG Business Account: encrypted access token,
  IG-scoped user ID, page ID, token expiry, connection status.
- **Automation** — a rule: name, status, linked `InstagramAccount`, optional scope
  (specific post/Reel vs. "all posts"), one or more `Trigger`s, one or more
  `Action`s, priority/ordering.
- **Trigger** — match type (`exact`, `contains`, `regex`, `ai_intent`), keyword(s),
  case sensitivity, source (`comment`, `dm`, `story_reply`, `live_comment`).
- **Action** — type (`send_dm`, `reply_comment`, `send_ai_reply`), payload
  (text/template, buttons/links), delay, follow-up sequencing (future).
- **CommentEvent** — every inbound Meta event received, with dedup key,
  processing status, matched automation (if any), timestamps.
- **MessageLog** — every outbound send attempt: status (`queued`, `sent`, `failed`,
  `rate_limited`), Graph API response, retry count.
- **Plan** — pricing tier definition (free / pro / etc.), monthly send limit,
  feature flags (AI features on/off).
- **Subscription** — Workspace ↔ Plan ↔ payment provider (Stripe/Razorpay) link,
  status, renewal date.
- **UsageRecord** — per-Workspace, per-billing-period counters (sends used, AI
  calls used) — checked by `billing.UsageService` before every send.
- **AuditLog** — sensitive actions (token connect/disconnect, plan changes, admin
  overrides) for support/debugging and compliance.

---

## 5. Scaling & reliability strategy ("thousands of requests")

- **Fast webhook ACK, slow processing**: the webhook receiver does the minimum
  (verify + dedup + enqueue) and returns 200 immediately, so Meta never sees
  timeouts even under load — all real work happens in workers pulling from BullMQ.
- **Horizontal worker scaling**: `worker.ts` is stateless and replica-safe; scale by
  running more worker containers (`docker-compose up --scale worker=N`). Queue
  concurrency per worker is configurable via env.
- **Per-account rate limiting**: Instagram/Meta limits apply per IG Business
  Account, not globally. The `messaging` module implements a Redis-backed token
  bucket keyed by `instagramAccountId`, so one creator's high-traffic Reel can't
  starve or throttle another creator's account.
- **Idempotency everywhere**: inbound Meta events are deduped by their event ID
  (Redis `SETNX` + Postgres unique constraint as backstop) before any processing,
  so retried webhook deliveries or job retries never cause a double DM.
- **Retry + dead-letter**: every BullMQ queue has bounded exponential-backoff
  retries; exhausted jobs land in a DLQ queue for inspection instead of vanishing.
- **Circuit breaker on Graph API**: repeated failures for a given IG account (e.g.
  expired token, persistent 429) trip a breaker that pauses sends for that account
  and flags it in the dashboard, instead of hot-looping failed retries.
- **Backpressure-aware DB access**: Prisma connection pool sized to match worker
  concurrency; heavy read paths (analytics) use indexed queries and are isolated
  from the write-heavy webhook/send path.
- **Stateless API tier**: `apps/api` HTTP instances hold no in-memory session state
  (JWT-based auth), so the API can also be scaled horizontally behind Nginx if
  needed.

---

## 6. Security architecture

- Instagram access tokens (and any other third-party secrets) are encrypted at
  rest with AES-256-GCM; the encryption key lives only in environment config, never
  in the database or source.
- Every Meta webhook request is validated against `X-Hub-Signature-256` using the
  app secret before its payload is trusted.
- Every Stripe/Razorpay webhook is validated against that provider's signature
  scheme before its payload is trusted.
- JWT-based session auth for the dashboard; short-lived access tokens + refresh
  tokens.
- Role-based guards for `admin` module endpoints.
- Input validation via DTOs on every external entry point (HTTP, webhook payload,
  queue job payload) — never trust shape or type without validation.
- Structured audit log for sensitive actions (token connect/disconnect, plan
  changes, admin actions).

---

## 7. Billing architecture

- `Plan` defines limits (monthly send cap, AI feature access, number of connected
  IG accounts).
- `UsageService` (in `billing`) is the single choke point: `automations`/
  `messaging` call `usageService.canSend(workspaceId)` before a send and
  `usageService.recordSend(workspaceId)` after — no other module tracks usage.
- `PaymentProvider` interface abstracts Stripe vs. Razorpay so the rest of the app
  only ever calls `paymentProvider.createSubscription(...)`,
  `paymentProvider.cancelSubscription(...)`, etc. Provider selection is based on
  the Workspace's billing country (Razorpay for India, Stripe elsewhere), decided
  once at checkout.
- Both providers' webhooks feed into the same `billing` event handling pipeline so
  subscription status stays in sync regardless of provider.

---

## 8. AI architecture

- `ai` module exposes a provider-agnostic interface (`AiProvider`) with methods
  like `classifyIntent(text)` and `generateReply(context)` — the current
  implementation calls out to an LLM API, but callers never know which one.
- AI work is dispatched via the `ai-processing` queue — never called synchronously
  from the webhook-handling path — so a slow/down AI provider degrades gracefully
  (automation falls back to its static action, or the send is delayed, but never
  blocks the whole pipeline).
- Per-workspace AI usage is tracked the same way as message sends, for future
  plan-based limits.

---

## 9. Frontend architecture (`apps/web`) — and how it satisfies SEO (CLAUDE.md §11)

Single Next.js App Router app, deliberately split by route group so the
SEO-critical public site and the authenticated app don't compromise each other:

```
apps/web/src/app/
  (marketing)/              ← public, SEO-critical, SSR/SSG, served at "/"
    page.tsx                  → "/" homepage
    features/comment-to-dm/page.tsx → "/features/comment-to-dm" etc.
    pricing/page.tsx
    blog/[slug]/page.tsx
    layout.tsx                 → shared header/footer, Organization JSON-LD
  (dashboard)/app/           ← authenticated app, client-heavy, served at "/app/*"
    layout.tsx                  → auth guard, app shell, robots: noindex
    automations/...
    analytics/...
    settings/...
  sitemap.ts                 ← generated sitemap.xml (Next.js convention)
  robots.ts                  ← generated robots.txt, disallows "/app/"
```

Note: the `/app` URL prefix (not just the `(dashboard)` route group) is what
makes the dashboard easy to exclude in `robots.ts` and keeps its URLs
visually distinct from marketing routes — the route group alone doesn't
affect the URL.

- `(marketing)` routes are Server Components by default, using
  `generateMetadata()` per route for unique titles/descriptions/OG tags, and embed
  JSON-LD (`Organization`, `FAQPage`, `BreadcrumbList`, `Article`, `Product`) as
  described in `CLAUDE.md` §11.
- `(dashboard)` routes are excluded from the sitemap and set `robots: noindex` —
  there is no SEO reason to index a logged-in app surface, and keeping it separate
  means dashboard interactivity choices never force a compromise on the marketing
  site's SSR/SEO requirements.
- Shared UI primitives (buttons, cards, form controls) live in
  `apps/web/src/components` and are used by both route groups; SEO-specific
  pieces (breadcrumb trail component + its JSON-LD twin, structured-data
  helpers) live alongside them so every new marketing page composes them instead
  of reinventing metadata/schema per page.

---

## 10. Deployment architecture

`docker-compose.yml` (dev) / `docker-compose.prod.yml` (prod) services:

- `postgres` — PostgreSQL, persisted volume
- `redis` — Redis, persisted volume (AOF) since it backs BullMQ job state
- `api` — NestJS HTTP server (`main.ts`), can scale to N replicas behind Nginx
- `worker` — NestJS worker process (`worker.ts`), scaled to N replicas
  independently of `api`
- `web` — Next.js app (marketing + dashboard)
- `nginx` — TLS termination, reverse proxy, routes `/` → web, `/api` → api

Environment separation via `.env` files per environment (`.env`, `.env.staging`,
`.env.production` — never committed; `.env.example` documents required keys).

---

## 11. Evolution path

This is intentionally a modular monolith, not microservices, per the decision in
`docs/decisions/0001-modular-monolith.md`. If/when a single module needs to scale
or deploy independently (most likely candidates: `messaging` under very high
send volume, or `ai` if it needs GPU/specialized infra), it can be extracted
because module boundaries already don't leak into each other's data access — that
extraction should not require a rewrite, only moving a module's folder into its
own NestJS app and swapping its in-process service calls for HTTP/queue calls.
