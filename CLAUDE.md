# CLAUDE.md — Project Rules for Convozy

> Product name: **Convozy** (Instagram comment → DM automation platform),
> deployed at **convozy.orincore.com** as a subdomain of orincore.com.
> Decided 2026-09-22 — see `TRACKER.md`'s Decisions log.

This file is the contract for anyone (human or Claude) writing code in this repo.
Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) before touching backend structure, and
update [`TRACKER.md`](./TRACKER.md) whenever you start, finish, or block on a task.
**Do not treat these rules as optional or as suggestions to "use judgment" against.**
If a change requires breaking a rule here, stop and raise it instead of silently
working around it.

---

## 1. What this product does

Instagram creators run a Reel/post and tell viewers "comment X and I'll DM you the
link." Convozy watches comments (and DMs, story replies, live comments) via the
Meta Graph API, matches them against creator-defined automation rules, and sends the
reply automatically — a free/low-cost alternative to ManyChat/tools like it, with
AI features (intent detection, AI-written replies, smart FAQ) layered on top.

Non-negotiable product constraints that shape the architecture:
- Must handle **thousands of concurrent webhook events** without dropping or
  duplicating sends.
- Must respect **Meta/Instagram Graph API rate limits per connected account**, not
  just globally — one customer's spike must never throttle another customer.
- Must be cheap to run (self-hosted Docker Compose on a VPS) so the free tier is
  sustainable.
- Every Instagram send is customer-facing and irreversible once sent — correctness
  and idempotency matter more than raw speed.

---

## 2. Tech stack (decided — do not change without updating this file + ARCHITECTURE.md)

| Layer | Choice |
|---|---|
| Backend | Node.js + TypeScript, NestJS, modular monolith |
| API validation | `class-validator` / `class-transformer` DTOs |
| ORM / DB | Prisma + PostgreSQL |
| Queue / cache | Redis + BullMQ |
| Frontend dashboard | Next.js (App Router) + TypeScript |
| Monorepo tooling | pnpm workspaces |
| Payments | Stripe (global) + Razorpay (India) |
| Deployment | Docker Compose on a self-hosted VPS (see `infra/`) |
| Reverse proxy / TLS | Nginx |

Do not introduce a second backend language, a second ORM, a second queue system, or
a second monorepo tool without an explicit decision recorded in
`docs/decisions/` (ADR format) and a TRACKER.md update.

---

## 3. Architecture rules

1. **Modular monolith, strict module boundaries.** Each domain module under
   `apps/api/src/modules/<name>` owns its own Prisma models conceptually and its own
   service layer. A module must not import another module's `*.service.ts`
   internals directly for DB writes — go through that module's exported service
   methods. This keeps the path to splitting into microservices later open.
2. **Controllers are thin.** Controllers validate input (via DTOs) and delegate to
   services. No business logic, no direct Prisma calls, in a controller.
3. **All webhook/queue work is idempotent.** Every inbound Meta event has a stable
   event ID. Before processing, check-and-record it (dedup table or Redis
   SETNX with TTL) so retries or duplicate webhook deliveries never double-send a
   DM.
4. **All outbound Instagram API calls go through the `messaging` module**, which
   owns the per-account rate limiter, retry/backoff, and circuit breaker. No other
   module calls the Graph API directly.
5. **Config is centralized and validated at boot** (`src/config`), using a schema
   (`zod` or `class-validator`) — the app must fail fast on missing/invalid env vars
   instead of failing at first use.
6. **Workers and the API share the same codebase** (same modules/services) but run
   as separate processes/entrypoints (`main.ts` vs `worker.ts`), so business logic
   is never duplicated between them.
7. **No cross-cutting "utils" dumping ground.** Shared, truly generic code lives in
   `packages/shared`; module-specific helpers stay inside that module.

---

## 4. Coding standards

- TypeScript `strict: true` everywhere. No `any` unless justified with a comment
  explaining why a proper type isn't feasible.
- Every module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`,
  `*.spec.ts`. Keep this shape consistent across modules so the codebase is
  navigable without memorizing exceptions.
- DTOs validate every external input (HTTP body/query/params, queue job payloads,
  webhook payloads). Never trust `req.body` shape without a DTO + `ValidationPipe`.
- Errors: throw NestJS `HttpException` subclasses (or a shared `AppException`) with
  a machine-readable error code, not raw strings. Never swallow errors silently —
  either handle them meaningfully or let them propagate to the global exception
  filter, which logs with correlation IDs.
- No premature abstraction. Three similar lines beat a speculative shared helper.
  Don't build for hypothetical future requirements — build for what the current
  phase in `TRACKER.md` actually needs.
- Comments explain *why*, not *what*. Default to no comments; add one only for a
  non-obvious constraint (e.g. "Meta requires this within 24h of the last user
  message — see docs/decisions/0003-24h-window.md").

---

## 5. Security rules (non-negotiable)

- **Instagram access tokens are encrypted at rest** (AES-256-GCM, key from env,
  never committed). Never log a token, even at debug level.
- **Every Meta webhook request is signature-verified** (`X-Hub-Signature-256`)
  before the payload is trusted or enqueued.
- Webhook verify tokens, API keys, DB credentials, encryption keys: `.env` only,
  never committed. `.env.example` documents every required variable with a
  placeholder, never a real value.
- All user input is validated server-side regardless of client-side validation.
- Rate-limit public endpoints (auth, webhook receiver) independently of the
  per-Instagram-account outbound rate limiter — these are two different concerns.
- PII (Instagram usernames, comment text, DM content) is data the user's customers
  own — don't ship it to third-party AI providers without it being part of a
  documented, opt-in AI feature (see §7).

### 5a. OWASP Top 10 (2021) — mandatory checklist for every change

This app handles third-party OAuth tokens, customer PII (comments/DMs), and
payment/subscription data. Every piece of code written — not just a periodic
audit — must be checked against this list before it's considered done. If a
category doesn't apply to a given change, that's fine; don't skip the check
silently on things that do apply.

1. **A01 Broken Access Control** — every endpoint enforces auth via
   `JwtAuthGuard` by default (opt out only with `@Public()` for routes that
   authenticate themselves another way, e.g. signature-verified webhooks).
   Every query scoped to a workspace/user filters by `workspaceId` from the
   authenticated `RequestUser`, never from a client-supplied ID — a user must
   never be able to read/modify another workspace's automations, accounts, or
   message logs by guessing an ID. Admin-only routes use `@Roles()` +
   `RolesGuard`.
2. **A02 Cryptographic Failures** — secrets (Instagram tokens, payment
   provider keys) encrypted at rest (§5), TLS everywhere in transit (Nginx
   terminates TLS, no plaintext HTTP in production), passwords hashed with
   bcrypt (never reversible), no sensitive data in JWTs beyond IDs/role.
3. **A03 Injection** — Prisma parameterizes all queries by default; never
   build raw SQL from string concatenation (`$queryRawUnsafe` is banned — use
   `$queryRaw` with tagged templates if raw SQL is ever unavoidable). All
   external input validated via DTOs (`class-validator`) before use, including
   webhook payloads and queue job payloads, not just HTTP bodies.
4. **A04 Insecure Design** — rate limiting and per-account throttling are
   designed in from Phase 1 (ARCHITECTURE.md §5), not bolted on later; plan
   limits are enforced server-side only (§8), never trust a client-reported
   plan tier.
5. **A05 Security Misconfiguration** — `helmet()` on every HTTP response,
   CORS restricted to known origins (never `*` in production), verbose
   stack traces never returned to clients (`GlobalExceptionFilter` returns a
   generic message + code, logs the real error server-side only), no default
   credentials anywhere, dependencies kept current (see A06).
6. **A06 Vulnerable and Outdated Components** — run `pnpm audit` (or
   equivalent) as part of CI before merging dependency changes; don't pin to
   known-vulnerable versions to avoid a minor upgrade.
7. **A07 Identification and Authentication Failures** — bcrypt with a strong
   cost factor for passwords, short-lived JWT access tokens with refresh
   rotation, no user enumeration via differing error messages on
   login/register (use the same generic "invalid email or password"),
   rate-limit login/register endpoints against brute force.
8. **A08 Software and Data Integrity Failures** — webhook payloads (Meta,
   Stripe, Razorpay) are only trusted after signature verification (§5); never
   deserialize untrusted data into executable code paths; lockfile
   (`pnpm-lock.yaml`) committed so installs are reproducible.
9. **A09 Security Logging and Monitoring Failures** — every auth failure,
   webhook signature failure, and admin action is logged with a correlation ID
   (§6, `GlobalExceptionFilter`); never log secrets or full token values, even
   on failure paths; audit-sensitive actions go through the `AuditLog` model
   (ARCHITECTURE.md §4), not just application logs.
10. **A10 Server-Side Request Forgery (SSRF)** — any feature that fetches a
    user-supplied URL (e.g. a future "custom webhook" or link-preview feature)
    must validate/allowlist the target and never fetch to internal/private IP
    ranges from the server on the user's behalf.

---

## 6. Reliability rules

- Every BullMQ queue has: a bounded retry count with exponential backoff, a
  dead-letter queue for exhausted retries, and alerting/visibility on DLQ growth
  (see `docs/runbooks`).
- Graph API calls implement backoff on `429`/rate-limit error codes and a circuit
  breaker per Instagram account so one throttled account doesn't stall the worker
  pool.
- Database migrations are additive/backwards-compatible by default (add column
  nullable, backfill, then tighten) so deploys never require downtime for a
  migration alone.
- Health checks (`/health`, `/health/ready`) must reflect real dependency status
  (DB, Redis) — not just "process is up."

---

## 7. AI feature rules

- AI features (AI-drafted replies, intent classification, smart FAQ) are opt-in per
  automation, not silently on by default.
- AI calls are async via a queue (`ai` module + dedicated queue), never inline in
  the webhook request path — a slow/failed LLM call must never delay or block
  comment-to-DM delivery for automations that don't use AI.
- Every AI provider call is behind a provider-agnostic interface in the `ai`
  module so the provider can change without touching callers.
- Track AI usage per account for cost control and future plan-based limits.

---

## 8. Billing rules

- Plan limits (e.g. free tier monthly send cap) are enforced in the `billing`
  module via a single `UsageService` check, called from `automations`/`messaging`
  before a send — never duplicate limit-checking logic in multiple modules.
- Stripe and Razorpay integrations sit behind a single `PaymentProvider` interface
  in `billing` so the rest of the app never branches on "which gateway."
- Webhook handlers for both payment providers verify signatures before trusting
  any event, same as Meta webhooks.

---

## 9. Testing

- New service methods get unit tests (`*.spec.ts`) alongside them, in the same
  PR/commit — not deferred.
- The webhook → queue → automation-match → send pipeline gets integration test
  coverage before it's marked done in `TRACKER.md`, since it's the core product
  path.
- Don't mock Prisma/DB for integration tests of this core path — use a real test
  Postgres (see `docker-compose.yml` test service) so schema drift is caught.

---

## 10. Git & workflow

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) so history
  stays scannable.
- Update `TRACKER.md` status for a task in the same commit/session that completes
  it — the tracker must always reflect reality, not aspiration.
- Don't commit `.env`, `node_modules`, build output, or Prisma migration
  lockfiles until they're actually generated and intended to ship.

---

## 11. SEO rules (frontend — non-negotiable, applies from the very first page)

The public site (marketing pages, blog, docs, pricing) must be built to legitimately
rank for terms like "auto reply tool," "Instagram comment automation," "auto DM
Instagram," etc. SEO is not a phase-8 polish task — every page and every frontend
change from day one must satisfy this checklist before it's considered done:

- **Rendering**: public/marketing pages use Next.js App Router **Server Components /
  SSR or SSG** — never client-only rendering for anything that needs to be indexed.
  The authenticated dashboard app can be client-rendered; the marketing site cannot.
- **Metadata**: every route exports proper `<title>` and `<meta name="description">`
  via Next.js `generateMetadata` — unique per page, never a repeated template with
  just the site name. Include Open Graph + Twitter Card tags on every public page.
- **Structured data**: use JSON-LD schema.org markup appropriate to the page —
  `Organization`/`SoftwareApplication` on the homepage, `FAQPage` on FAQ sections,
  `BreadcrumbList` on every page below the homepage, `Article` on blog posts,
  `Product`/`Offer` on pricing. This is required, not optional decoration.
- **Breadcrumbs**: every non-homepage route renders a visible breadcrumb trail *and*
  emits matching `BreadcrumbList` JSON-LD. Breadcrumb structure must mirror the
  actual URL hierarchy.
- **URL structure**: clean, descriptive, kebab-case URLs (`/features/comment-to-dm`,
  not `/f?id=3`). No unnecessary query-string-driven canonical content.
- **Semantic HTML**: one `<h1>` per page, logical `<h2>`/`<h3>` hierarchy, `<nav>`,
  `<main>`, `<article>`, `<header>`/`<footer>` used for their actual meaning — not
  div-soup. Every `<img>` has descriptive `alt` text.
- **Performance**: public pages must hit good Core Web Vitals (LCP, CLS, INP) —
  optimize images (`next/image`), avoid render-blocking JS on the marketing site,
  keep third-party scripts (analytics, chat widgets) deferred/async.
- **Technical infrastructure**: maintain a generated `sitemap.xml` and `robots.txt`
  from the start; every new public route must be reflected in the sitemap
  automatically (generate it, don't hand-maintain it). Canonical `<link>` tags on
  every page to prevent duplicate-content issues.
- **Content**: landing/feature pages target real keyword intent (e.g. "Instagram
  auto reply tool," "comment to DM automation," "ManyChat alternative for
  Instagram") in the `<h1>`, first paragraph, and metadata — written for humans
  first, never keyword-stuffed.
- **Accessibility ties into SEO**: proper landmark roles and heading order also
  improve crawlability — don't treat a11y and SEO as separate concerns on the
  marketing site.

Any PR that adds or edits a public-facing frontend page must satisfy this checklist
before being marked done in `TRACKER.md`. See `ARCHITECTURE.md` §Frontend for how
the marketing site vs. dashboard app are split to make this enforceable.

---

## 12. UI/design standards — must not look "AI-generated"

Every piece of UI work on this project — marketing site, dashboard, emails,
automation-builder screens, anything a user sees — must invoke the **`taste-skill`**
skill before designing or building it. This applies to first drafts and redesigns
alike, not just polish passes.

Rationale: default LLM output UI has a recognizable, generic "AI-generated" look
(templated hero sections, predictable spacing/shadows/gradients, stock layout
patterns). This product competes with established tools (ManyChat, etc.) on trust
and polish as well as price — the UI needs to look like it was built by a real
product/design team, not scaffolded.

Rules:
- Before writing or editing any UI code (component, page, layout, email template),
  load `taste-skill` and follow its guidance for that surface.
- This applies in combination with, not instead of, the SEO rules in §11 —
  semantic HTML, metadata, and breadcrumbs still apply regardless of visual style.
- If a design decision from `taste-skill` conflicts with an accessibility or SEO
  requirement in this file, accessibility/SEO wins — fix the tension, don't drop
  the requirement.
- Don't fall back to default component-library styling untouched (e.g. shipping
  unstyled shadcn defaults) — every surface should reflect a deliberate, specific
  design direction, not a framework's out-of-the-box look.

### 12a. Locked visual theme (user directive, 2026-09-22)

Convozy's theme is **locked dark, monochrome black and white** — no color
brand accent. This is a deliberate, fixed decision, not a default to swap
later without asking:

- **Dark only.** No light mode, no `prefers-color-scheme` switching. Every
  surface (marketing site and dashboard) renders dark.
- **Monochrome.** No hue-based accent color (no blue/purple/coral/etc.).
  Primary actions use an **inverted white-on-black treatment** (white
  background, black text/icon) instead of a brand color for emphasis.
  Semantic colors (success green, error/danger red) are the only exception —
  those convey real state, not brand identity, and stay as-is.
- **Source of truth:** the CSS custom properties in
  `apps/web/src/app/globals.css` (`--color-background`, `--color-foreground`,
  `--color-muted`, `--color-card`, `--color-border`, `--color-accent`
  [= white], `--color-accent-foreground` [= black], `--color-success`,
  `--color-danger`). Every new component pulls from these tokens — never
  hardcode a new color inline.
- Applies to `taste-skill`'s dial guidance too: when the skill's color
  calibration rules (Section 4.2, single saturated accent) would suggest
  adding a hue, this override wins instead — monochrome is the accent
  decision for this project.

### 12b. UI element source (user directive, 2026-09-22)

For interactive/decorative UI elements — buttons, toggles, switches,
checkboxes, loaders/spinners, badges, form controls, cards — check
[uiverse.io](https://uiverse.io) for a suitable community element first,
rather than hand-inventing bespoke CSS from scratch. Adapt (don't
copy-paste unmodified) whatever's found to:
- fit the locked dark monochrome theme (§12a) — swap any hue-based colors
  for the project's tokens,
- use the project's existing token system (`--radius-control`, `--color-*`
  from `globals.css`) instead of the snippet's own hardcoded values,
- match the project's stack (Tailwind utilities / plain CSS module, not a
  framework the snippet assumed).
Note the element's uiverse author in a short code comment when adapting a
specific snippet closely, as a courtesy credit. Full bespoke layout
sections (hero, pricing tables, page structure) still come from `taste-skill`
— uiverse is for the smaller interactive/decorative pieces, not page
composition.

### 12c. Dashboard page inventory (user directive, 2026-09-23)

[`ui.md`](./ui.md) catalogs the full set of logged-in dashboard pages ManyChat
has (Contacts, Broadcasting, Growth Tools, Analytics, Settings/Profile/Billing,
etc.), researched specifically so Convozy builds the equivalent **page
inventory** over time — as of 2026-09-23 the dashboard only has 3 top-level
pages (Accounts, Automations, Activity; see `ui.md` §2). This is a checklist of
*what pages should eventually exist*, not a visual reference:

- `ui.md` documents ManyChat's page/navigation structure and Convozy's
  equivalent-or-gap status for each — read it before adding or proposing a new
  dashboard page, so pages aren't invented ad hoc or duplicated.
- Every page built from that inventory still goes through the locked dark
  monochrome theme (§12a) and the existing `components/ui/` primitives —
  ManyChat's own visual design (colors, layout, component style) is never a
  reference, only the list of pages and what each is for.
- This does not override §13's phase discipline or this session's "one
  feature at a time" execution rule — `ui.md` is a roadmap to build against
  incrementally, not a license to scaffold every page in one pass. Building a
  feature (e.g. Contacts, Milestone 2) includes building its page(s) from this
  inventory as part of that same milestone, not before.

---

## 13. When in doubt

Prefer: fewer moving parts > more moving parts. Boring, explicit code > clever
code. A working, correctly-scoped module for the current phase > a speculative
"complete" framework for phases three steps ahead. Check `TRACKER.md` for what
phase we're actually in before building beyond it.

---

## 14. Feature completeness standard (non-negotiable, user directive 2026-09-23)

This governs **depth**, not breadth — it does not override §13's phase
discipline. §13 says don't build features from later phases early; this
section says whatever feature IS being built, in whatever phase, must be
built completely, not a shortcut or partial slice of itself.

- When implementing a feature that's on the roadmap (a `TRACKER.md` phase
  item, or an entry from `MANYCHAT_FEATURE_AUDIT.md` the user has asked to
  build), implement **every real option/variant that feature needs to
  function as advertised** — not just the happy path, not "good enough for
  a first pass," not a stub with a `// TODO: handle X later`.
- No silent partial implementations: don't ship a trigger/action/step type
  that only handles one case among several documented ones while silently
  no-op'ing or dropping the others. If a case genuinely can't be handled
  yet, that's a scoping decision — surface it explicitly (ask, or flag
  loudly in `TRACKER.md` with what's missing and why), never ship it quietly
  as if the feature were whole.
- This applies to the full stack for that feature, every time: backend
  service logic + DTOs/validation for every input the feature accepts +
  `*.spec.ts` coverage (§9) + frontend UI exposing every real option (not
  just a minimal happy-path form) + a `TRACKER.md` entry marked `✅ done`
  only once it's genuinely complete end-to-end (implemented, tested,
  deployed, verified against real production behavior — see §10's "the
  tracker must always reflect reality, not aspiration").
- A hard external constraint (a real Meta API limitation, a cost that
  breaks the free-tier promise in §1, a security requirement in §5) is a
  legitimate reason to scope a feature narrower than its full ideal shape —
  but that constraint must be verified (not assumed) and documented in
  `TRACKER.md` next to the feature, exactly like the "verify, don't guess"
  discipline already established for Meta API specifics elsewhere in this
  file. A missing feature is honest; a feature that silently only half-works
  is not.
