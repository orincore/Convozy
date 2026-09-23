# TRACKER.md — Convozy Build Tracker

> Keep this file honest. Update status the moment you start/finish/block on a task.
> This is the single source of truth for "what's actually done" — not memory, not
> chat history. See `CLAUDE.md` §10.

Status legend: `☐ todo` · `▶ in progress` · `✅ done` · `⛔ blocked`

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-22 | Backend: Node.js + TypeScript, NestJS, modular monolith | IO-heavy webhook workload, fastest path to production, one language across API + dashboard |
| 2026-09-22 | DB/queue: PostgreSQL + Prisma, Redis + BullMQ | Standard, well-understood, cheap to self-host |
| 2026-09-22 | Deployment: Docker Compose on a self-hosted VPS | Minimal-cost hosting to sustain a free tier; can move to managed cloud later without a rewrite |
| 2026-09-22 | Payments: Stripe + Razorpay behind a `PaymentProvider` interface | Razorpay for India (UPI, INR), Stripe for the rest of the world |
| 2026-09-22 | Frontend: single Next.js app, `(marketing)` route group SSR/SEO-optimized, `(dashboard)` route group client app, `noindex` | SEO is a day-one requirement (see `CLAUDE.md` §11), not a later phase |
| 2026-09-22 | UI must go through the `taste-skill` skill for every surface | Avoid the generic "AI-generated" look; product competes on polish, not just price — see `CLAUDE.md` §12 |
| 2026-09-22 | Production VPS: Hostinger KVM 2 (2 vCPU / 8GB RAM / 100GB NVMe) | User-confirmed. `docker-compose.prod.yml` resource caps and worker replica count (2) are sized for this box — revisit if upgraded |
| 2026-09-22 | Pinned to current stable majors (NestJS 12, Next.js 16, React 19, ESLint 9) instead of the versions originally scaffolded (NestJS 10, Next 14, React 18, ESLint 8) | Initial pins were stale enough to carry 62 known vulnerabilities (3 critical, 28 high) per `pnpm audit`, mostly transitive (old Express/body-parser/multer/qs via NestJS 10, a Next.js cache-poisoning advisory). Re-verified against installed package metadata rather than assumed — see CLAUDE.md §5a A06 |
| 2026-09-22 | Held Prisma at 5.22 (not the 8.0.0 release candidate) | 8.0 isn't stable yet; don't pin production code to an RC. Revisit once Prisma 8 goes stable |
| 2026-09-22 | Product named **Convozy**, deployed at **convozy.orincore.com** | User picked from 4 options (AutoDM, ReplyFlow, Convozy, Pingly). Chosen for distinctiveness/ownability over a fully literal keyword match — means the on-page/content SEO strategy in `CLAUDE.md` §11 carries more of the ranking weight than the name itself |

Open ADRs to write as they come up: `docs/decisions/0001-modular-monolith.md`,
`docs/decisions/0002-per-account-rate-limiting.md`.

---

## Open questions for the user (blocking or near-blocking)

- ✅ Meta App ID / App Secret: in `.env` (App ID `1783603603770160`, name
  "automation"). No webhook fields subscribed yet — blocked on adding the
  Webhooks product first (see "Meta App audit" section below).
- ⛔ App Review: not started, and **not ready to start** — see "Meta App
  audit" section below for why and the sequencing plan.
- ✅ Domain: **convozy.orincore.com** (subdomain of orincore.com) — applied in
  `nginx.conf`, `.env.example` production notes. Still needed: create the
  DNS record (CNAME/A) pointing it at the KVM 2 VPS before Phase 9 deploy.
- ✅ VPS provider/specs: Hostinger KVM 2 (2 vCPU / 8GB RAM / 100GB NVMe) — sizing applied in `docker-compose.prod.yml`
- ☐ Stripe account and Razorpay account already created, or need setup steps
  documented?
- ✅ Product name: **Convozy** — decided 2026-09-22, applied across the repo
  (package names, metadata, docs). Logo/visual identity still TODO (Phase 7,
  `taste-skill` pass).
- ☐ Free tier limits — what's the actual number (e.g. 100 sends/month) we're
  designing `Plan` defaults around?

---

## Meta App audit (2026-09-22)

User checked the Meta developer app dashboard directly (App ID
`1783603603770160`, name "automation"). A later session gained a
browser-control tool and drove the dashboard directly for the read-only
audit and the "Add Product" clicks noted below; anything requiring a
judgment call (Business Portfolio linking, App Secret handling, App Review
submission) was left to the user regardless.

**Done:**
- `.env` populated: `META_APP_ID`, `META_APP_SECRET` (user copied from
  Settings → Basic), freshly generated `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`,
  `META_WEBHOOK_VERIFY_TOKEN`. Verified against `env.validation.ts`'s format
  rules (length/URL/hex checks) — all pass.
- Legal pages required for Basic Settings now exist and are live in the repo:
  `/privacy`, `/terms`, `/data-deletion` (`apps/web/src/app/(marketing)/...`),
  added to `sitemap.ts`. Working drafts, not legally reviewed — flagged to
  the user.
- **Products added**: "Instagram Graph API" and "Facebook Login" both added
  via the dashboard (Facebook Login for Business's "Configurations" screen
  turned out to require a Business Portfolio link, which isn't set up — see
  Phase 1 log above for how the Instagram connect flow was actually
  unblocked, via the direct Instagram Login flow instead).

**Still needed in the dashboard (user must do — Claude won't click through
account-linking/legal/irreversible steps without asking first):**
1. **Webhooks product**: still shows "Set up" (not added) — its
   Verify-and-Save step needs a publicly reachable callback URL, so this
   can't be completed until `convozy.orincore.com` is deployed (Phase 9).
2. **Basic Settings fields**, once pages are deployed (see sequencing below):
   - Privacy Policy URL → `https://convozy.orincore.com/privacy`
   - Terms of Service URL → `https://convozy.orincore.com/terms`
   - Data Deletion Instructions URL → `https://convozy.orincore.com/data-deletion`
   - App domains → `convozy.orincore.com`
   - Category → suggest "Business" or "Productivity and Publishing"
   - Add a Website platform entry pointing at `https://convozy.orincore.com`
3. **Permissions**: `instagram_business_basic`,
   `instagram_business_manage_messages`,
   `instagram_business_manage_comments`,
   `instagram_business_content_publish`, `pages_show_list` all show Standard
   access / no App Review requested yet — these are the ones the actual
   connect flow uses (see Phase 1 `OAUTH_SCOPES`). `pages_manage_metadata`
   still doesn't appear anywhere in Permissions and Features; now understood
   why — it's a Facebook-Page-scoped permission surfaced via Facebook Login
   for Business's Configurations screen, which is gated behind a Business
   Portfolio link this app doesn't have. Since the product uses the direct
   Instagram Login flow (no Page involved), this permission isn't actually
   needed — safe to drop from future permission-request planning unless a
   Page-linked feature gets added later.

**Why App Review shouldn't be submitted yet (sequencing):** Meta's review for
Advanced Access on messaging/comment permissions requires a working demo
(screencast) of the actual feature — and often Business Verification. Right
now the automation matching engine and message sending are still stubs
(Phase 2/3, not built). Submitting now would likely be rejected for lack of a
working demo and would burn a review cycle. Correct order:
1. Add the two Products in the dashboard (doable now, no review needed).
2. Deploy `convozy.orincore.com` for real (Phase 9) so the legal-page URLs
   and Website platform entry resolve.
3. Fill in Basic Settings fields once (2) is live.
4. Build enough of Phases 1–3 (OAuth connect, matching engine, message send)
   to have a real end-to-end demo.
5. Only then request App Review with a screencast of that demo.

---

## Competitive feature audit

See [`MANYCHAT_FEATURE_AUDIT.md`](./MANYCHAT_FEATURE_AUDIT.md) (2026-09-23) —
full catalog of every ManyChat feature, marked free vs. paid (and at which
tier) on their side, plus a prioritized build recommendation list. Use it when
scoping new phases/features rather than re-researching ManyChat from scratch.

---

## Phase 0 — Foundation & scaffolding

- ✅ System architecture documented (`ARCHITECTURE.md`)
- ✅ Project rules documented (`CLAUDE.md`)
- ✅ This tracker created
- ✅ Monorepo scaffold (pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`)
- ✅ NestJS app bootstrap (`apps/api`) — config module (env-validated via zod),
  Prisma module, Redis module, queue module, health module (`/api/health`,
  `/api/health/ready`), global exception filter, correlation ID middleware,
  JWT auth guard + roles guard wired as global guards
- ✅ Prisma schema — full data model from `ARCHITECTURE.md` §4
- ✅ Docker Compose (dev + prod): postgres, redis, api, worker, web, nginx —
  prod variant sized for the Hostinger KVM 2 VPS
- ✅ `.env.example` with every required variable documented
- ✅ Next.js app bootstrap (`apps/web`) with `(marketing)` / `(dashboard)/app`
  route groups, `sitemap.ts`, `robots.ts`, example pages (home, pricing,
  comment-to-DM feature) demonstrating the SEO pattern from `CLAUDE.md` §11
- ✅ Dependency currency + security pass: bumped to current majors (NestJS 12,
  Next.js 16/React 19, ESLint 9 flat config, Prisma 5.22 — held back from the
  8.0 release candidate since it's not yet stable), `pnpm audit` clean (0
  known vulnerabilities) across the whole workspace as of 2026-09-22
- ✅ Auth module (register/login, JWT, bcrypt) — real implementation, not a stub
- ✅ Webhook receiver: signature verification (`X-Hub-Signature-256`), Meta
  subscription handshake, Redis dedup, BullMQ enqueue — real implementation
- ☐ CI basics: lint + typecheck + test on push (GitHub Actions or equivalent)
- ☐ Git repo pushed to remote (currently local-only, `git init` done)

## Phase 0.5 — Local dev environment + Google OAuth (added 2026-09-22)

- ✅ Local Postgres 15 + Redis running via Homebrew (no Docker needed for dev);
  `convozy` role/database created, `prisma migrate dev` applied (`init`
  migration).
- ✅ `.env` fully populated and verified against the zod schema (Meta App ID
  `1783603603770160`, Google OAuth client, generated secrets).
- ✅ Fixed a real env-loading bug: `ConfigModule.forRoot()` defaults to
  `cwd`-relative `.env`, but pnpm runs package scripts with cwd = the
  package dir, not the repo root — added `resolveEnvFilePath()`
  (`apps/api/src/config/env-file-path.ts`) so `.env` at the monorepo root is
  found from both `apps/api` (local dev) and Docker (where env vars are
  injected directly anyway).
- ✅ Fixed a real zod bug: blank `KEY=` lines in `.env` parse as `""`, which
  failed `.url().optional()` fields instead of being treated as unset — added
  an `optional()` helper in `env.validation.ts` that treats `""` as absent.
- ✅ **Google OAuth login implemented end-to-end** (additive to existing
  email/password): `passport-google-oauth20` strategy, `User.passwordHash`
  now nullable + `User.googleId` (migration applied),
  `AuthService.loginOrRegisterWithGoogle`, and a one-time Redis-backed
  exchange-code flow (`/auth/exchange`) so JWTs never travel in a redirect
  URL — see `CLAUDE.md` §5a A02/A07. Minimal frontend pages:
  `/app/login` (Google button + email/password form) and `/auth/callback`
  (exchanges the code, stores tokens, redirects to `/app`).
- ✅ Verified live: real Google sign-in created a User + Workspace row in
  Postgres (confirmed via `psql`), full round trip through both dev servers
  (API :3000, web :3001).
- Known simplification to revisit before real launch: tokens stored in
  `localStorage` (XSS-exposed) — fine for local testing, flagged in
  `lib/auth.ts` to move to httpOnly cookies before Phase 4's real dashboard.

---

## Phase 0.6 — Real UI design pass (added 2026-09-22)

- ✅ Design system stood up in `apps/web`: Tailwind v4 (`@tailwindcss/postcss`,
  `@tailwindcss/typography`), Geist font (`geist` package), Phosphor icons,
  Motion (`motion/react`), `cn()` helper, shadcn-style primitives
  (`components/ui/{button,input,label,card}.tsx`).
- ✅ **Theme locked per explicit user directive**: dark only, monochrome
  black/white (no brand hue) — documented in `CLAUDE.md` §12a as the
  binding decision, source of truth is `apps/web/src/app/globals.css`.
  Primary actions use an inverted white-bg/black-text treatment instead of
  a color accent. Semantic red/green kept for real state (success/danger).
- ✅ **UI element source directive**: check uiverse.io for buttons/toggles/
  loaders/etc. before hand-inventing CSS, documented in `CLAUDE.md` §12b.
  Note: no browser/computer-use tool in this session and WebFetch is
  blocked by uiverse.io (403) — elements are sourced via the user pasting
  code from the site (or another agent) for adaptation. First one done:
  `components/ui/switch.tsx` (+ `switch.module.css`), adapted from a
  uiverse.io toggle, converted off styled-components (not our stack) to a
  CSS Module, colors remapped to our tokens, red/green indicator kept as
  semantic on/off state — built for the future automation-enable toggle,
  not wired into a page yet (no automations UI exists until Phase 2).
- ✅ Marketing site redesigned per `taste-skill` (asymmetric split hero,
  bento feature grid, distinct layout family per section, zero em-dashes,
  real component-preview visual instead of a fake screenshot): `/`,
  `/pricing`, `/features` (new index), `/features/comment-to-dm`, plus
  typographic treatment for `/privacy`, `/terms`, `/data-deletion` via a
  shared `LegalArticle` wrapper.
- ✅ Dashboard shell + login page rebuilt with the shadcn-style primitives:
  `/app/login` (Google button with the required multi-color Google mark,
  email/password form), `/auth/callback`, `DashboardShell`/`DashboardChrome`
  (topbar + logout, skipped on the login route), and a real empty state on
  `/app` (connect-Instagram CTA) per taste-skill's empty-state requirement.
- ✅ Verified: typecheck/lint/build clean, `pnpm audit` clean, dev server
  restarted and all routes return 200 after adding the typography plugin
  (a stale `next dev` process briefly errored on the new dependency until
  restarted — not a code bug).
- ☐ Still pending: full automation-builder UI, analytics views, settings
  (all Phase 2-4, nothing to design yet since the backend doesn't exist).

---

## Phase 1 — Instagram connection & webhook pipeline

- ✅ Meta OAuth flow implemented: `GET /api/instagram/oauth/start` (protected,
  returns the authorize URL), `GET /api/instagram/oauth/callback` (public,
  Meta redirects here), `GET /api/instagram/accounts` (protected, lists
  connected accounts). Dashboard `/app` shows connected accounts or a
  connect prompt. See `apps/api/src/modules/instagram/instagram.service.ts`.
- ⚠️ **Diagnosed and fixed a wrong-credentials bug** (2026-09-22): first
  attempt at Instagram API with Instagram Login (`www.instagram.com/oauth/
  authorize`, no Facebook Page involved) got "Invalid Request: Invalid
  platform app". Briefly pivoted to Facebook Login for Business
  (`config_id`-based, matching a ManyChat request the user inspected) before
  that product turned out not to be available in this app's dashboard
  either. Researched Meta's current docs directly
  ([Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login),
  via `developers.facebook.com/documentation/instagram-platform/llms.txt`)
  and confirmed the real cause: **Instagram Login uses its own App ID/App
  Secret**, separate from the main Meta App ID (`META_APP_ID`) used for
  webhook signing — found at App Dashboard → Instagram → "API setup with
  Instagram login" → Business login settings. We'd been passing the wrong
  ID as `client_id`. Reverted to the direct Instagram Login flow
  (`www.instagram.com/oauth/authorize` → `api.instagram.com/oauth/
  access_token` → `graph.instagram.com/access_token` →
  `graph.instagram.com/me`), now using new `META_INSTAGRAM_APP_ID` /
  `META_INSTAGRAM_APP_SECRET` env vars instead of the main app credentials.
- ✅ Redirect URI saved, `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET`
  in `.env`. User confirmed the connect flow works live end-to-end (connect
  button → Instagram consent → callback → account appears connected).
- ✅ **Confirmed definitively via Meta's official current docs** (2026-09-22,
  second pass): connected the official `meta_social_technologies` MCP server
  (`claude mcp add --transport http meta_social_technologies
  https://mcp.facebook.com/devtools`, OAuth login required — see below for
  the profile gotcha) and pulled live app config + doc search. Confirmed via
  `devtools_app` that `oauth_redirect_uris` was genuinely `null` (never
  saved) — that was blocking every attempt regardless of flow. Also briefly
  detoured back into the classic Facebook Login + Pages flow when the user's
  dashboard didn't show a "Facebook Login for Business" product, then
  confirmed via live doc search
  ([Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login),
  [Instagram Platform Overview](https://developers.facebook.com/documentation/instagram-platform/overview))
  that "Business Login for Instagram" (the direct, no-Page flow) is exactly
  right and does use a separate Instagram App ID/Secret, exactly as
  originally implemented — reverted back to that for the final time.
- **MCP setup gotcha worth remembering**: the user's `claude` shell alias
  overrides `CLAUDE_CONFIG_DIR` to a different profile (`.claude-omniroute`,
  used for a multi-account router) than the one this session actually runs
  under (`.claude-client2`, via their `c2` alias). `claude mcp add`/`login`
  run through plain `claude` silently hit the wrong profile. Fix: invoke the
  real binary directly with the correct env var —
  `CLAUDE_CONFIG_DIR="$HOME/.claude-client2" /Users/orincore/.local/bin/claude mcp add ...`
  (same for `login`, which also needs a real interactive terminal — it
  cannot complete through a non-interactive Bash tool call).
- ✅ Verified live: connect button → Instagram consent → callback → account
  appears connected. First real end-to-end test of this flow, confirmed by
  the user 2026-09-22.
- ✅ Token refresh job: `InstagramService.findAccountsNeedingTokenRefresh` /
  `refreshAccountToken` (7-day-before-expiry window, marks the account
  `TOKEN_EXPIRED` on a rejected refresh rather than throwing) + a new
  `TokenRefreshProcessor` (`apps/api/src/queues/processors/token-refresh.processor.ts`)
  running an hourly BullMQ repeatable scan, registered in `worker.module.ts`.
  Per-account try/catch so one account's failure never blocks the others.
- ✅ Webhook receiver endpoint: signature verification, dedup, enqueue (done in
  Phase 0 — see above)
- ✅ `CommentEvent` persistence + dedup: `webhook-events.processor.ts` now
  creates the `CommentEvent` row (Postgres unique-constraint backstop behind
  the Redis SETNX check — a `P2002` on `externalEventId` is caught and
  treated as a no-op duplicate, not an error) and enqueues an
  `AUTOMATION_MATCH` job keyed by the new `commentEventId`. Actual matching
  logic stays a Phase 2 stub, exactly as scoped.
- ✅ Unit tests added alongside the above (CLAUDE.md §9, not deferred):
  `webhook-events.processor.spec.ts` (dedup-as-no-op on `P2002`, successful
  persist + enqueue, unknown-account drop, non-duplicate errors rethrown for
  BullMQ retry) and `instagram.service.spec.ts` (refresh window query,
  successful token refresh + round-trip decrypt, `TOKEN_EXPIRED` on a
  rejected refresh). Along the way, found and fixed a real pre-existing gap:
  these were the first specs to import anything from `@nestjs/*`, which
  surfaced that NestJS 12's package line (`@nestjs/common`, `@nestjs/config`,
  `@nestjs/bullmq`, `@nestjs/bull-shared`) ships ESM-only and ts-jest's
  default CommonJS transform can't load it — `import.meta.url` inside
  `@nestjs/common` itself, not just the bullmq packages. A real fix means a
  full ESM Jest migration (`"type": "module"`, ts-jest ESM preset), too
  invasive for this task; instead these two specs `jest.mock()` the
  `@nestjs/*` decorators/classes they transitively import, since neither
  test goes through Nest's DI container anyway (classes are constructed
  directly). Flagging this as a real Phase-8-or-earlier task: any future
  spec touching a class that imports `@nestjs/*` will hit the same wall and
  need the same mock treatment until there's a proper ESM Jest setup.
- ✅ Per-account webhook subscription: `InstagramService.subscribeToWebhooks`
  now calls `POST /{ig-user-id}/subscribed_apps?subscribed_fields=comments,messages`
  right after a successful connect (field names confirmed against Meta's
  live docs, not assumed — see `CLAUDE.md`'s established pattern of
  verifying rather than guessing after the earlier wrong-App-ID incident).
  Failure is logged and non-fatal — it never blocks account connection.
  Still outstanding: the App Dashboard's own **Webhooks product** (app-level
  subscription to the `instagram` object) still shows "Set up" — its
  Verify-and-Save step needs a publicly reachable callback URL, so it can't
  actually be completed until `convozy.orincore.com` is deployed (Phase 9).
- ⚠️ **Production incident, diagnosed and fixed live (2026-09-22, ~6:50–7:01
  PM UTC)**: user reported "automation is not working" — live VPS log check
  found `POST /api/webhooks/instagram -> 500: Error: Custom Id cannot be
  integers` from BullMQ. Root cause: `WebhooksService.enqueueIfNew` passed
  Meta's raw numeric `externalEventId` (e.g. `18095218910439494`) straight
  through as the BullMQ job id; BullMQ 5.x rejects any all-digit custom
  jobId. **Every comment webhook was failing**, and worse — the Redis dedup
  key was set *before* the enqueue, so once the enqueue threw, Meta's
  redelivery of the same event just logged "Duplicate webhook event
  ignored" and was dropped for good (confirmed two real customer comment
  events lost this way: `17999447849992008`, `18107696974915028`). Fixed by
  (1) prefixing the jobId (`webhook-${externalEventId}`, matching the
  existing no-colon jobId convention from the earlier BullMQ jobId bug in
  Phase 3) and (2) deleting the dedup key if the enqueue itself throws, so a
  transient failure no longer permanently blackholes the event. New
  regression tests in `webhooks.service.spec.ts` (all-digit jobId rejected,
  dedup rollback on enqueue failure). Full suite verified: 93/93 tests,
  clean `tsc --noEmit`. Hotfixed straight to the VPS (single file, no schema
  change, independent of the not-yet-deployed Phase 5.1 work below) —
  `api` container rebuilt + restarted, `/health` → 200, user confirmed live
  "now its working" after posting a fresh test comment.
- ⛔ **Known limitation, verified live (2026-09-24): collaboration posts
  don't appear in the "Applies to → Specific posts" picker.** Root cause:
  `InstagramService.listRecentMedia` only calls `GET /{ig-user-id}/media`,
  which per Meta's own docs and community forum only returns media the
  account *published* — a genuine collab post (this account is a
  collaborator, not the original publisher) never appears there, even
  though Instagram's own app shows it on the collaborator's profile. Meta
  does have a dedicated `GET /<IG_USER_ID>/collaborative_media` endpoint
  (launched April 2026), but it's documented only under "Instagram API with
  Facebook Login" (`graph.facebook.com`, Page-linked). **Tested live against
  the real connected account (`ig_orincore`, 2026-09-24)** on
  `graph.instagram.com` (the host Convozy's Business Login for Instagram
  flow actually uses): `400 {"error":{"message":"Tried accessing
  nonexisting field (collaborative_media)"}}` — a clean "field doesn't
  exist on this host," not a permissions error. Fixing this for real would
  mean adding the Facebook-Login-linked connection flow alongside (not
  instead of — Business Login for Instagram is still needed for everything
  else) the current one, since that earlier flow was already tried and
  explicitly abandoned once this session (see the Phase 1 "wrong-App-ID"
  diagnosis above) for not being viable for this app. Real scope, not a
  quick fix — flagged here rather than silently dropped, not attempted
  without the user explicitly asking for the dual-connection-flow work.

## Phase 2 — Automation engine

- ✅ `Automation` / `Trigger` / `Action` CRUD API — new `automations` module
  (`apps/api/src/modules/automations/`): `AutomationsController` (list, get
  one, create, update, delete, all scoped to `RequestUser.workspaceId`, never
  a client-supplied one — CLAUDE.md §5a A01) + `AutomationsService`. Create
  verifies the target `instagramAccountId` actually belongs to the caller's
  workspace via `InstagramService.accountBelongsToWorkspace` (new method,
  added instead of querying `InstagramAccount` directly — module boundary
  rule, CLAUDE.md §3). DTOs (`create-automation.dto.ts`,
  `update-automation.dto.ts`, `dto/trigger.dto.ts`, `dto/action.dto.ts`)
  validate nested triggers/actions via `class-validator` +
  `@Type()`/`@ValidateNested()`, matching the global `ValidationPipe`'s
  `whitelist`/`forbidNonWhitelisted` config in `main.ts`. `update()` treats a
  provided `triggers`/`actions` array as a full replace (delete + recreate in
  a transaction), not a merge — simplest correct option until the dashboard
  builder (Phase 4) needs incremental edits.
- ✅ Matching engine: exact / contains / regex trigger matching against
  `CommentEvent`, implemented in `AutomationsService.matchCommentEvent`
  (called from `automation-match.processor.ts`, which was a stub — now just
  invokes the service per CLAUDE.md §3 rule 1). Automations are evaluated
  active-only, highest `priority` first, first full match wins. `AI_INTENT`
  match type always returns no-match for now (Phase 6, not built).
  - **Real security finding, not just a correctness detail**: trigger REGEX
    patterns are creator-authored and run in the shared worker process on
    every webhook event for that account — a pathological pattern
    (catastrophic backtracking) would otherwise block the event loop for
    every *other* workspace's jobs too, directly violating the
    non-negotiable "one customer's spike must never throttle another"
    constraint (CLAUDE.md §1 / ARCHITECTURE.md). Mitigated two ways: (1)
    `AutomationsService.validateTriggers` rejects an unparseable pattern at
    write time (400, not a silent no-op later), and (2) `regexMatches` runs
    the actual `.test()` inside `node:vm`'s `runInNewContext` with a 50ms
    wall-clock `timeout`, so even a syntactically-valid but catastrophic
    pattern (e.g. `^(a+)+$` against a non-matching string) gets killed and
    treated as a non-match instead of hanging the worker. Covered by a test
    that would time out (10s Jest timeout) if the guard didn't work —
    `automations.service.spec.ts` "treats a pathological regex as a
    non-match instead of hanging the worker".
- ✅ Action execution: `dispatchAction` enqueues `MESSAGE_SEND` (for
  `SEND_DM`/`REPLY_COMMENT`) or `AI_PROCESSING` (for `SEND_AI_REPLY`, per its
  own job shape — `{ commentEventId, automationId, kind: 'GENERATE_REPLY' }`,
  not reused from `MessageSendJobData`) jobs from the matched automation's
  actions, respecting each action's `delaySeconds` via BullMQ's `delay`
  option. `recipientId` on comment-sourced events is the comment's own
  `externalEventId` — Meta's Private/Public Reply APIs key off the comment
  ID directly, not a separate user ID; a DM-sourced event would need the
  sender's IG-scoped user ID instead, once Phase 1's `entry.messaging[]`
  webhook mapping is filled in. Action payload supports a `{{username}}`
  template placeholder (`renderText`) — matches ARCHITECTURE.md §4's "payload
  (text/template, buttons/links)", nothing richer built yet (no premature
  templating engine).
- ✅ Automation scoping (specific post vs. all posts): `SPECIFIC_POSTS`
  automations only match when `CommentEvent.mediaId` is in
  `scopeMediaIds`; `ALL_POSTS` (the default) matches any post.
- ✅ Automation priority/ordering: `findMany` orders by `priority desc, createdAt asc`;
  `matchCommentEvent` takes the first automation whose triggers match, so
  higher-priority automations win ties.
- ✅ Unit tests (`automations.service.spec.ts`, 12 cases): matching (CONTAINS,
  REGEX, scoping, priority-implied first-match, retry no-op, already-processed
  no-op), the regex DoS guard specifically, `SEND_AI_REPLY` routing to the
  right queue, and CRUD ownership boundaries (create rejects a
  not-in-workspace `instagramAccountId`, create rejects a bad regex,
  `findOne` 404s rather than leaking cross-workspace existence). Hit the
  same `@nestjs/*` ESM mocking pattern as the Phase 1 specs — see above.

## Phase 3 — Messaging (send pipeline)

- ✅ `messaging` module (`apps/api/src/modules/messaging/`): `MessagingService`
  is the only place that calls the Graph API for sends (CLAUDE.md §3 rule 4).
  `MessageSendProcessor` (was a stub) now delegates to it. Endpoints
  confirmed against Meta's live docs before writing any code, not assumed —
  this project has a documented history (Phase 1) of getting Graph API
  specifics wrong when guessed:
  - `SEND_DM` (private reply) → `POST /{ig-user-id}/messages` with
    `{ recipient: { comment_id }, message: { text } }` — note it's the
    account's own IG-scoped ID in the path, **not** `me`, which is what was
    assumed before checking.
  - `REPLY_COMMENT` (public reply) → `POST /{comment-id}/replies` with
    `{ message: text }`.
  - `payload.buttons` (link buttons) are appended as plain-text links rather
    than sent as a generic button template — that request shape isn't
    verified against current docs, and guessing at an unverified shape here
    risks a silently malformed request; plain text is a safe fallback until
    it's actually confirmed.
- ✅ Per-account rate limiter (`RateLimiterService`): Redis fixed-window
  counter (`INCR` + `EXPIRE`), not a Lua-script token bucket — simpler,
  matches this codebase's existing Redis usage style, small burst tolerance
  at window boundaries is an accepted tradeoff. Default cap
  (100 req/hour/account) is a **deliberately conservative placeholder**, not
  Meta's exact published number — direct doc URLs for this 404'd; only
  third-party aggregator figures were available (200/hr general Business Use
  Case, up to 750/hr specifically for private replies per some sources).
  Flagging this rather than presenting it as confirmed: **re-verify the
  actual granted limit from the App Dashboard's own rate-limit display
  before launch** and adjust the constant in `rate-limiter.service.ts`.
- ✅ Circuit breaker (`CircuitBreakerService`): opens after 5 consecutive
  failures for an account, 5-minute cooldown, auto-closes via Redis TTL (no
  half-open probe state — more machinery than this phase needs). Flips
  `InstagramAccount.status` to `RATE_LIMITED` on open / back to `ACTIVE` on
  the next success, satisfying ARCHITECTURE.md §5's "flags it in the
  dashboard" (the flag exists now; there's no dashboard yet to show it,
  Phase 4).
- ✅ `MessageLog` persistence: one row per processing attempt (using the
  schema's existing `attempt` field as designed — `job.attemptsMade + 1`),
  with `status`/`graphApiResponse`/`errorCode` set from the real outcome.
- ✅ Dead-letter handling + **failed sends are never lost** (explicit user
  requirement): BullMQ's own `attempts: 5` + exponential backoff
  (`queue.module.ts` defaults) handles short-term transient retries.
  Beyond that, jobs land in BullMQ's failed set (kept indefinitely —
  `removeOnFail: false`) rather than being dropped, and a new periodic scan
  (`MessageSendProcessor`'s `dlq-requeue-scan`, every 5 minutes, added as a
  repeatable job on the same queue since BullMQ ties one Worker to one
  queue) re-queues them with a fresh attempt budget — capped at 5 requeue
  rounds, and skipped once the account is no longer `ACTIVE` (retrying is
  pointless until the creator reconnects; that's a permanent failure, not a
  transient one). Nothing is ever silently deleted: `MessageLog` in Postgres
  is the durable record regardless of what happens to the BullMQ job itself.
- ✅ **Fixed a real correctness bug in the Phase 2 code this depends on**:
  `AutomationsService.matchCommentEvent` was marking `CommentEvent` `MATCHED`
  *before* dispatching its actions. If dispatch threw partway through
  (e.g. a Redis hiccup enqueueing the 2nd of 3 actions), a BullMQ retry of
  that job would see the event was already `MATCHED` and skip reprocessing
  entirely via the `PENDING`-only guard — silently dropping the remaining
  actions. Fixed by (1) moving the status update to *after* all actions are
  dispatched, so a partial failure makes the whole job retry from scratch,
  and (2) giving every dispatched job a stable `jobId`
  (`${commentEventId}:${action.id}`), so a retried dispatch that re-enqueues
  an already-enqueued action is a safe no-op instead of a duplicate send.
- ✅ Unit tests: `rate-limiter.service.spec.ts` (3), `circuit-breaker.service.spec.ts`
  (5), `messaging.service.spec.ts` (9 — both endpoints' exact request shape,
  circuit/rate-limit short-circuits, missing-credentials clean return,
  Graph API error → `FAILED`/`RATE_LIMITED` classification, `attempt`
  numbering), `message-send.processor.spec.ts` (6 — job-name routing, DLQ
  requeue round cap, inactive-account skip, never-requeue-the-scan-job-itself).

### Real production incident (2026-09-24): a comment reply posted 5 times

User report: "comment reply was posted 5 times." Live VPS log check found the
root cause fast — `MessagingService.send` re-threw on **every** Graph API
error, so BullMQ's default retry policy (5 attempts, exponential backoff)
retried a `REPLY_COMMENT` job 5 times. Each attempt got back `500
{"error":{"message":"An unknown error has occurred.","type":"OAuthException",
"code":1}}` from Meta — an ambiguous error, not a clean rejection — and per
the user, Meta's write actually succeeded on some/all of those 5 attempts
despite returning an error each time. DM sends were unaffected (confirmed by
the user) — same code path, just didn't hit this specific Meta flake during
the incident window.

**Fix**: `MessagingService.send` now only lets BullMQ auto-retry on an
explicit `429` (rate limited — Meta didn't process it) or a genuine
network-level failure (no `GraphApiError`, meaning no response ever reached
us). Any other confirmed Graph API response (4xx or 5xx) is recorded as
`FAILED` in `MessageLog` and returns without rethrowing — visible for manual
follow-up, never silently lost, but never blindly re-sent either. This
directly trades "never lose a failed send" (the original Phase 3 design
intent) for "never duplicate an irreversible send" where the two conflict —
the right call per CLAUDE.md §1's own stated priority ("correctness and
idempotency matter more than raw speed"). 3 new/updated tests in
`messaging.service.spec.ts` (non-429 Graph error doesn't rethrow, the exact
ambiguous-500 scenario doesn't rethrow, a genuine network failure still
does). 111/111 tests, clean tsc/lint.

## Phase 4 — Dashboard (creator-facing app)

- ✅ Auth (signup/login, JWT sessions) — built in Phase 0.5/0.6: email/password
  + Google OAuth, `/app/login`, `AuthGuard`. Still on the flagged dev-stage
  simplification (`lib/auth.ts`): tokens in `localStorage`, XSS-exposed.
  **Not fixed this pass** — an httpOnly-cookie migration touches the auth
  module, the OAuth exchange flow, and every frontend fetch call, and risks
  breaking the already-verified-live Google login. Flagged again, explicitly,
  as a pre-launch (Phase 9) blocker, not a "maybe."
- ✅ Connect Instagram account UI — already existed from Phase 1
  (`/app/page.tsx`: connect prompt / connected-accounts list), left as-is.
- ✅ Automation builder UI (trigger + action configuration): new
  `/app/automations` (list — status toggle via the existing uiverse-adapted
  `Switch`, delete, action-type icons) and `/app/automations/new` (create —
  dynamic trigger rows source/matchType/keywords, dynamic action rows
  type/message/delay, `{{username}}` template hint). `SEND_AI_REPLY`
  deliberately left out of the action-type selector: the AI pipeline is a
  Phase 6 stub, so offering it would silently do nothing — a real UX-honesty
  issue, not an oversight. **Deferred**: an edit page for existing
  automations (create-only for now; editing needs delete + recreate).
- ✅ **Specific-posts scoping got a real post picker** (was deferred, then
  requested): left-column form / right-column sticky panel layout. The
  panel is a live post grid fetched from a new `GET /instagram/accounts/:id/media`
  endpoint (`InstagramService.listRecentMedia`, `graph.instagram.com`
  `GET /{ig-user-id}/media`) — fields/endpoint confirmed against a doc source
  specific to Business Login for Instagram after an earlier general Graph
  API doc page turned out to mix in `graph.facebook.com`/Page-linked-flow
  details that don't apply to this app's flow (same "verify, don't guess"
  discipline as the send endpoints below). Thumbnails render via
  `next/image` with `unoptimized` (Instagram's CDN hostnames aren't
  whitelist-able in `next.config` — confirmed against the bundled Next 16
  docs, per `apps/web/AGENTS.md`, that `unoptimized` serves the image as-is
  and bypasses the domain-restricted optimization pipeline entirely, rather
  than assuming and hoping).
- ✅ **Story-reply automations** (explicitly requested, not in the original
  Phase 4 scope): this needed more than a UI checkbox, since story replies
  don't arrive the way comments do. Real implementation, end to end:
  - `WebhooksController` now parses `entry[].messaging[]` (was entirely
    unhandled — `TriggerSource.DM`/`STORY_REPLY` existed in the schema with
    no webhook path feeding them). Only messages with `message.reply_to.story`
    are mapped to a `STORY_REPLY` `CommentEvent`; plain DMs
    (`reply_to.mid` or no `reply_to`) are intentionally still skipped — DM
    automations weren't asked for, and doing them properly needs their own
    design pass. `fromUsername` is set to the sender's IG-scoped user ID,
    not a real handle: this webhook payload doesn't include a username the
    way comments do, and resolving one would mean an extra Graph API call
    per incoming message. Known, flagged simplification — `{{username}}`
    shows a numeric ID for story-reply-triggered replies, not a handle.
  - **Real bug this surfaced and fixed**: replying into a story-reply (or
    future DM) conversation uses a completely different Graph API request
    shape than a comment's private reply (`{ recipient: { id } }` vs
    `{ recipient: { comment_id } }` — confirmed via live docs, not assumed).
    `MessageSendJobData` gained a `recipientType: 'comment' | 'user'` field;
    `AutomationsService.dispatchAction` sets both `recipientId` and
    `recipientType` from the originating event's source (comment ID for
    COMMENT/LIVE_COMMENT, the sender ID stored in `fromUsername` for
    STORY_REPLY); `MessagingService.callGraphApi` branches on it, with a
    defense-in-depth throw if `REPLY_COMMENT` is ever paired with a
    non-comment recipient (there's no comment thread to reply into) — caught
    earlier in `dispatchAction`, which skips that combination rather than
    enqueueing a doomed job.
  - `/app/automations/new`'s trigger-source picker now includes "Story
    reply"; the message-field hint conditionally warns about the numeric-ID
    limitation when a story-reply trigger is present.
  - Tests: `webhooks.controller.spec.ts` (new — story reply mapped, plain DM
    skipped, reply-to-message skipped), plus new cases in
    `automations.service.spec.ts` (`recipientType: 'user'` + sender-id
    recipient for story replies, `REPLY_COMMENT` skipped on a
    conversation-sourced event) and `messaging.service.spec.ts` (the `user`
    recipient shape, the `REPLY_COMMENT`-on-non-comment guard) and
    `instagram.service.spec.ts` (`listRecentMedia` mapping, empty-account,
    Graph-API-error-returns-empty-not-throw).
- ✅ Live activity feed (comment events, sends, statuses): required a new
  backend piece since faking the data isn't this project's style — a
  `activity` module (`GET /activity`, workspace-scoped) that reads across
  `CommentEvent`/`InstagramAccount`/`Automation`/`MessageLog`. This is a
  slice of the `analytics` module ARCHITECTURE.md §3 describes ("aggregates
  from MessageLog/CommentEvent"), pulled forward since Phase 4 needed a real
  feed now. Frontend at `/app/activity`.
- ☐ Analytics views (sends over time, top-performing automations) — **not
  done, honestly deferred**, not attempted-and-hidden. The `activity` feed
  above covers "what happened, most recent first"; this item is aggregated
  charts over time, which needs its own design pass and likely a couple of
  new indexed queries (`MessageLog` grouped by day/automation). Worth doing
  as a focused follow-up rather than folding into this already-large pass.

**Design-system note**: `taste-skill` (CLAUDE.md §12) explicitly scopes
itself to landing/marketing pages and excludes "dashboards / dense product
UI / admin panels" (its own Section 13), pointing instead to a real
component system — which this project already has (shadcn-style primitives
+ Tailwind tokens, Phase 0.6). Consulted `ui-ux-pro-max` for dashboard-
specific structural/density/accessibility guidance instead; its suggested
colored/glassmorphism palette was overridden by the locked monochrome theme
(CLAUDE.md §12a) — only semantic `success`/`danger` (already-existing
tokens) are used for status, consistent with "one accent, no new hues."

## Phase 5 — Billing

- ☐ `Plan` / `Subscription` / `UsageRecord` data model
- ☐ `PaymentProvider` interface + Stripe implementation
- ☐ `PaymentProvider` Razorpay implementation
- ☐ Checkout flow (country-based provider selection) in dashboard
- ☐ `UsageService.canSend` enforcement wired into `automations`/`messaging`
- ☐ Plan-limit-reached notifications

### Phase 5.1 — Entitlements system (ManyChat-parity batch, added 2026-09-23)

Plan: `/Users/orincore/.claude-client1/plans/vectorized-growing-perlis.md`.
Everything ships free today — this only builds the mechanism to gate a
feature later via data, not code.

- ✅ **Deployed and verified live (2026-09-24).** Code done, tests passing,
  migration applied to both local dev and production. Found late: this
  module had actually never made it to the VPS (only coded/tested locally),
  which meant production's `automations.service.ts`/`auth.service.ts` were
  silently running without the `EntitlementsService` dependency they'd
  otherwise need — caught and fixed as part of the git-based deploy sync
  below, before it could cause a real production failure.
  - `Plan.features Json @default("{}")` + `PaymentProviderType.NONE` +
    `AutomationTemplate` model added to `schema.prisma`; hand-written
    additive migration at
    `apps/api/prisma/migrations/20260923010000_billing_features_and_templates/`
    — applied via `prisma migrate deploy` on both local dev and production
    2026-09-24.
  - `billing` module: `entitlements.constants.ts` (`FEATURE_KEYS`:
    `LIVE_COMMENT_AUTOMATION`, `AUTOMATION_TEMPLATES`), `entitlements.service.ts`
    (`EntitlementsService.isEnabled`/`ensureFreeSubscription`/idempotent
    `bootstrapFreePlan` on `OnModuleInit`), `billing.module.ts` exports it.
  - Wired into `AuthService.register` / `loginOrRegisterWithGoogle` (creates
    a free `Subscription` per new Workspace) and into
    `AutomationsService.create`/`update` (throws `ForbiddenAppException` if
    a `LIVE_COMMENT` trigger's workspace has the feature off — always passes
    today, proves the gating pattern).
  - Tests: `entitlements.service.spec.ts` (8), extended
    `automations.service.spec.ts` (+4 for the entitlement-gated path),
    extended `auth.service.spec.ts`'s mock helper. Full suite verified green:
    `npx jest` 90/90, `npx tsc --noEmit` clean, `pnpm run lint` 0 errors
    (108 pre-existing `any` warnings in test files, none new).
- ▶ **Live Comment Automation** (first real feature gated through the
  system): `instagram.service.ts`'s `WEBHOOK_SUBSCRIBED_FIELDS` changed
  `'comments,messages'` → `'comments,live_comments,messages'` — confirmed
  `live_comments` is current/correct against Meta's live docs (both the
  `meta_social_technologies` MCP doc search and a direct web search of
  developers.facebook.com/docs/instagram-platform/webhooks) before editing;
  the old code comment claiming only two fields existed was stale, not
  trusted blindly. New regression test in `instagram.service.spec.ts`
  asserts the subscribe call's `subscribed_fields` param includes it.
  Frontend already had "Live comment" as a selectable trigger source
  (Phase 4) — this was the only missing wiring.
- ☐ **Automation templates still not started** — now Milestone 3 of the
  full feature-parity plan below, not built yet.
- ✅ Deployed 2026-09-24 (see Phase 5.2's deploy notes for the mechanics).
  **Still needed**: ask the user to **reconnect their test Instagram
  account** (`subscribeToWebhooks` only re-subscribes at connect time, so
  an already-connected account won't pick up `live_comments` otherwise).

---

### Phase 5.2 — Full ManyChat feature-parity build (user directive, 2026-09-23)

User directive: implement every free/paid Instagram-relevant feature in
`MANYCHAT_FEATURE_AUDIT.md`, completely (CLAUDE.md §14, added this session —
no shortcuts, every real option a feature needs), **one feature at a time**
(explicit correction mid-session — not all at once). Full 10-milestone plan
approved via plan mode: `/Users/orincore/.claude-client2/plans/elegant-watching-summit.md`.
Page-inventory companion doc: [`ui.md`](./ui.md) (ManyChat's dashboard page
list researched 2026-09-23, mapped to Convozy equivalents/gaps — Convozy
only has 3 logged-in pages today; a Settings/Profile/Billing page is a real
gap this surfaced that isn't in the 10-milestone list yet, see `ui.md` §4).

**Milestone 1 — Condition/branching step: ✅ done, deployed, verified live (2026-09-24).**
- Schema (additive migration `20260924010000_condition_branching`):
  `ActionType.CONDITION`, `ActionBranch{THEN,ELSE}`, `ConditionField`
  (`COMMENT_TEXT`/`SENDER_USERNAME` only for now — `IS_FOLLOWER` etc. are
  additive later), `Action.parentActionId`/`branch` (self-relation tree,
  cascade delete), new `Condition` model mirroring `Trigger`'s match-type
  semantics exactly (including the honest `AI_INTENT` stub) — CLAUDE.md §14's
  own test case: branching supports every option a trigger does.
- Backend: `AutomationsService` gained `dispatchActionTree`/`conditionMatches`
  (shares the same `vm`-sandboxed regex-timeout matching as triggers),
  `validateActionTree` (`MAX_ACTION_TREE_DEPTH = 5`, explicit documented
  bound), and switched `create`/`update` to explicit recursive
  `tx.action.create()` calls instead of a single nested Prisma write — a
  self-referential `children` relation can't be combined with Prisma
  auto-populating the unrelated `automationId` FK on deeply nested rows.
- **Real bug found and fixed during browser verification** (not just
  reasoned about): the `actions` relation query had no `where: {parentActionId: null}`
  filter, so Prisma returned every Action row flat (including ones already
  nested under a CONDITION's `children`) — a THEN/ELSE action would fire a
  *second* time, unconditionally, as if it were a root action. Caught live
  via a Playwright browser test creating a real branching automation and
  inspecting the API response, not just from code review. Fixed
  (`ACTIONS_INCLUDE`'s root-level `where` clause) and covered by a new
  regression test asserting the query shape directly (mocked-Prisma unit
  tests can't otherwise catch this class of bug).
- Frontend: new recursive `components/automations/action-step-editor.tsx`
  (THEN/ELSE tree editor), two new primitives `components/ui/select.tsx` /
  `badge.tsx` (uiverse.io returns 403 to WebFetch in this environment,
  confirmed again — built bespoke on the existing token system instead, per
  the established fallback), wired into `automations/new/page.tsx`.
- Verified: 105/105 backend tests, clean `tsc`/lint (both apps), full
  frontend build, and an end-to-end browser test (Playwright, headless)
  creating a real branching automation through the actual UI, round-tripped
  through the real API against local Postgres, confirming the persisted
  tree structure and dispatch logic are correct.
- **Deploy mechanics changed mid-milestone**: the user published the repo to
  GitHub (`https://github.com/orincore/Convozy.git`) and asked for git-based
  deploys instead of scp. Converted `/root/convozy` on the VPS to a real git
  checkout (safely — `git reset` then `git checkout main -- .`, never a
  destructive `git checkout -f`; `.env`/`docker-compose.vps.yml`/
  `web.Dockerfile` aren't tracked and were confirmed untouched). This sync
  also surfaced and fixed the fact that Phase 5.1's entire billing module had
  never actually reached the VPS despite being "done" locally for hours —
  see Phase 5.1's note above. New durable deploy pattern recorded in memory:
  local commit+push → VPS `git fetch origin` + `git merge origin/main --ff-only`
  (checked `git status`/`git diff --stat` clean first) → rebuild the
  affected containers → `up -d` → verify `/health` + logs.

**Follow-up fix, same day (user directive, 2026-09-24): "match anything"
when no keyword is set.** Previously a CONTAINS/EXACT trigger or condition
with an empty `keywords` array silently matched *nothing* (`[].some(...)`
is always false) — now it matches *every* comment/condition-check
unconditionally, since there's nothing to check against. REGEX is
unchanged (still requires a pattern, rejected at write time if missing —
no sensible "match anything" regex to assume). Implemented in the shared
`AutomationsService.matchesKeywords` (used by both triggers and M1's
conditions), DTO comments updated, frontend validation relaxed to only
require a keyword for REGEX (`automations/new/page.tsx`,
`action-step-editor.tsx`'s `validateActionSteps`), hint text updated to
say "leave blank to match every comment." 6 new backend tests (empty
CONTAINS/EXACT triggers match anything, empty REGEX trigger still never
matches, empty CONTAINS condition always routes THEN). 109/109 tests,
clean tsc/lint both apps, verified live via a direct API create call.
Committed (`3b07669`), pulled + rebuilt + restarted on the VPS, health
checks clean.

**Real production incident, same day (2026-09-24): a REPLY_COMMENT
automation replied to itself in an infinite loop.** An automation with an
empty-keyword ("match anything") trigger publicly replied to a comment;
Meta's `comments`/`live_comments` webhook legitimately re-delivered that
reply as a fresh comment event authored by the connected account itself;
nothing distinguished that from a real viewer, so it matched its own
trigger and replied to itself again — a new public reply every ~3-4
seconds. Caught live from VPS logs within minutes of the report (different
`externalEventId` every cycle, not a retry of one job — ruled out the
`MessagingService` retry fix from earlier the same day). Fixed with a
structural guard, `InstagramService.isOwnAccountComment(instagramAccountId,
{id, username})`, checked in `WebhooksController.receive()` for every
comment/messaging event before mapping or enqueueing — a self-authored
event never reaches automation matching/dispatch at all, so no trigger
configuration (however broad) can cause this again. 9 new tests (5 on
`isOwnAccountComment` itself, 4 on the controller's guard, including the
exact incident payload shape). 147/147 tests, clean tsc/lint. Deployed
immediately (`978c7b3`) — verified live afterward: no further loop activity
in worker logs post-deploy. Documented here as a standing architectural
lesson: **any feature that can cause the connected account to post publicly
needs this same self-authorship check considered explicitly**, not just
comments — e.g. Milestone 4's Comments Growth Tool (`HIDE_COMMENT`,
`REPLY_COMMENT`) inherits this guard for free since it reuses the same
webhook pipeline, but a new source of automated public posts added outside
that pipeline would not.

**Milestone 2 — Contacts, Tags, Custom Fields, Segments: ✅ done, deployed, verified live (2026-09-24).**
- Schema (additive migration `20260925010000_contacts_tags_segments`):
  `Contact`/`Tag`/`ContactTag`/`CustomField`/`ContactFieldValue`/`Segment`
  models, `CustomFieldType` enum, `CommentEvent.fromIgScopedId` column
  (previously dropped entirely for comment-sourced events — `change.value.from.id`
  exists in Meta's payload and was just never captured).
  Ships **free, no entitlement gate** — matches the audit's own
  recommendation (unlike Milestone 1's live-comment gate, which existed
  specifically to prove the gating pattern works).
- Backend: new `contacts` module. `ContactsService.recordInbound` is called
  from `WebhookEventsProcessor` for every inbound event (matched or not,
  non-fatal — never blocks the core pipeline). Full CRUD for tags/custom
  fields (typed value validation: NUMBER/BOOLEAN/DATE/TEXT) and segments (a
  recursive `all`/`any`/`tag`/`field` rule tree, evaluated at read time via
  `SegmentsService`-equivalent `buildSegmentWhere` — never materialized, so
  segment membership is never stale). Segment field comparisons scoped to
  `eq`/`neq`/`contains` — `gt`/`lt` deliberately deferred and documented in
  the DTO, since `ContactFieldValue.value` is stored as text and a correct
  numeric comparison needs a typed column or raw SQL, real scope beyond this
  milestone. 25 service tests + updated webhook-pipeline tests.
- Frontend: dashboard nav restructured from a 3-item pill row into a
  grouped left sidebar (`Accounts` standalone; `Automate` → Automations;
  `Audience` → Contacts/Segments/Tags/Custom fields; `Insights` → Activity)
  — the 3-item nav genuinely overflowed once this milestone's 4 new
  destinations landed, per `ui.md`'s own prediction. New pages: `/app/tags`,
  `/app/custom-fields`, `/app/contacts` (+ `/app/contacts/[id]` detail, tag
  add/remove, custom-field value editing), `/app/segments` (+ live member
  counts) and `/app/segments/new`. The segment rule builder is a
  **deliberately-scoped flat ALL/ANY list** of tag/field conditions, not a
  full nested-group tree editor — the backend already supports arbitrary
  nesting (tested), so this is a documented UI scope decision (CLAUDE.md
  §14), not a backend limitation; nested-group UI can be added to this same
  page later with zero backend changes.
- Verified end-to-end twice: once via direct API calls (create tag/field/
  segment, tag a manually-inserted contact, confirm segment membership and
  field value round-trip through real Postgres) and once through the actual
  browser UI (Playwright, headless — every new page loads with zero console
  errors, the segment-creation form round-trips through the real API and
  lands back on the segments list showing the real live member count).
- 147/147 backend tests, clean `tsc`/lint on both apps, clean frontend
  production build (all 6 new routes registered). Deployed via the new
  one-command `infra/scripts/deploy.sh` (`git fetch` + `--ff-only` merge +
  build + migrate + restart + health check) — see that script's own header
  for the mechanics. Live health check clean post-deploy.

**Milestone 3 — Pre-built automation templates: ✅ done, deployed, verified live (2026-09-23).**
- No schema change — `AutomationTemplate` already existed
  (`20260923010000_billing_features_and_templates`), just unused until now.
- Backend: new `templates.seed.ts` (5 curated starters spanning COMMENT/
  STORY_REPLY/LIVE_COMMENT — `reply-link-dm`, `pricing-dm`, `faq-freebie`,
  `story-reply-thanks`, `live-comment-welcome`), `TemplatesService`
  (`OnModuleInit` idempotently upserts by `slug` on every boot, `list()`,
  `install(workspaceId, templateId, instagramAccountId)` — gated behind
  `FEATURE_KEYS.AUTOMATION_TEMPLATES`, deserializes the template into a real
  `CreateAutomationDto` and delegates to `AutomationsService.create` rather
  than duplicating any validation/entitlement logic (CLAUDE.md §3 rule 1)),
  `TemplatesController` (`GET /automation-templates`,
  `POST /automation-templates/:id/install`). `AutomationWithRelations`
  exported from `automations.service.ts` (was private) for the new service's
  return type. 8 new tests.
- Frontend: **deliberately does not call the `install` endpoint.** Per the
  design already documented in `templates.seed.ts`'s own header comment, the
  "New automation" builder (`automations/new/page.tsx`) fetches
  `GET /automation-templates` and, on "Use this template," prefills the
  *existing* local trigger/action-step state (name, triggers, action tree)
  for review and editing before the user hits the real "Create automation"
  submit — never a blind install. Rationale: there is no automation-edit
  page yet (only create), and templates default to `status: ACTIVE`, so a
  blind install would go live with unedited placeholder copy
  (`[add your link here]`) with no UI path to fix it before it starts
  firing. The `install` REST endpoint itself is still fully real, tested,
  and reachable (a legitimate API surface for future direct-install
  entry points) — just not this surface's chosen path. New `TemplatePicker`
  component (inline in `new/page.tsx`, matching the existing `PostPicker`/
  `MediaThumb` local-component convention), `templatesApi`/`AutomationTemplate`
  added to `lib/api.ts`.
- Verified end-to-end via headless Playwright against the real local API/DB:
  all 5 template cards render with correct source badges, "Use this
  template" prefills name/triggers/keywords/message text correctly, the
  confirmation banner + "Clear" reset both work, and a full submit
  (template → Create automation) round-trips through the real API and
  persists the correct trigger row (`LIVE_COMMENT`/`CONTAINS`/`{}` keywords)
  in Postgres. Zero browser console errors throughout.
- 155/155 backend tests, clean `tsc`/lint on both apps (web: 0 errors, 1
  pre-existing unrelated warning; api: 0 errors, 143 pre-existing `any`-in-test
  warnings, same count as Milestone 2).
- Deployed via `infra/scripts/deploy.sh` (`4c11f9c` → `cfb5c1e`), all 3 images
  rebuilt, no pending migrations. Live health check `{"status":"ok"}`, worker
  logs confirm `TemplatesController` routes registered and all 5 templates
  seeded/refreshed on boot, and `GET /automation-templates` against the real
  public API correctly 401s an invalid token (JwtAuthGuard enforced, no
  stack trace leaked).

**Real production bug report, same day (user, 2026-09-23): "delete and edit
button is not working" on `/app/automations`.**
- **Delete, root cause**: none of the app's 5 `@Delete()` routes
  (`automations`, `tags`, `custom-fields`, `segments`,
  `contacts/:id/tags/:tagId`) had an explicit `@HttpCode`, so Nest's default
  for `@Delete()` is `200`, not `204`. The frontend's shared `authFetch`
  client only skips `res.json()` on a literal `204`; on `200` with an empty
  body it called `res.json()` anyway, which throws a `SyntaxError` — not an
  `ApiError` — so every delete button's catch block fell through to its
  generic `"Could not delete the..."` fallback message even though the
  backend had actually deleted the row. This was **not a regression from
  Milestone 3** — same bug existed since each of these routes was first
  written; the user was first to hit it on the automations page specifically.
  Root-caused by reproducing live against the real local API (`curl -v`
  showed `200 OK` with `Content-Length: 0`) rather than guessing, per the
  session's standing "verify, don't guess" discipline. Fixed by adding
  `@HttpCode(HttpStatus.NO_CONTENT)` to all 5 routes — the correct REST
  status for a body-less delete anyway, not a workaround.
- **Edit, root cause**: not a bug — there was genuinely no edit page or edit
  button anywhere in the app (only create + delete + pause/activate toggle
  existed). Built one: extracted the ~450-line inline builder out of
  `automations/new/page.tsx` into a shared `components/automations/
  automation-form.tsx` (`AutomationForm`, takes an optional `automation` prop
  — present = edit, absent = create) so create and edit share every piece of
  behavior (trigger rows, the recursive condition/branch tree editor, the
  post picker) with zero duplicated logic. New route
  `automations/[id]/edit/page.tsx`. New `deserializeActionSteps` in
  `action-step-editor.tsx` (exact inverse of the existing
  `serializeActionSteps`) turns a persisted branching action tree back into
  the editor's local tree shape, handling nested THEN/ELSE recursively. The
  template picker is hidden in edit mode (templates are a "start fresh"
  concept), and the Instagram-account field is shown disabled with an
  explanatory note, matching `UpdateAutomationDto`'s own documented
  design — an automation's account is intentionally not patchable
  (disconnect + recreate instead), not an oversight.
- Verified end-to-end against the real local API/DB via headless
  Playwright, including the harder case: created a real THEN/ELSE branching
  automation via the API, opened it in the new edit page, confirmed both
  branches' text/condition prefilled correctly, saved with no changes, and
  confirmed the persisted tree round-tripped through Postgres byte-for-byte
  correct (types/branches/keywords all intact). Delete verified separately —
  created, deleted via the real UI, confirmed the row disappears with zero
  console errors and zero error banner.
- 155/155 backend tests still green after the `@HttpCode` change (nothing
  asserted the old `200`), clean `tsc`/lint on both apps.
- Deployed via `infra/scripts/deploy.sh` (`cfb5c1e` → `c664938`), health
  check clean, all 5 `DELETE` routes confirmed registered in live worker
  logs, and a real create-then-delete round-trip against the live
  production API (`POST /tags` + `DELETE /tags/:id`) returned a genuine
  `204 No Content`, not the old `200`.

**Milestone 4 — Comment Moderation (rescoped from "Comments Growth Tool"): ✅
done, verified locally, pending VPS deploy.**
- **Rescoping decision (user-confirmed 2026-09-23, before any code was
  written):** researched what ManyChat's "Comments Growth Tool" actually
  does (not just the name) — it's comment automation (already have) + an
  opt-in button + a require-follow gate ("follow us to get the link"). That
  is Milestone 6 (require-follow gating) wearing a marketing name, not a new
  capability. Folded it into Milestone 6 instead of building it twice.
  Auto-follow-back stays dropped (confirmed earlier: no Graph API write
  endpoint exists for it anywhere in Meta's docs). What Milestone 4 actually
  builds instead: **Comment Moderation** — Meta's real, separate
  `POST /<COMMENT_ID>?hide=true` capability (confirmed via live Meta docs
  search, `ig-comment` reference), exposed as a new automation action so a
  creator can auto-hide spam/off-topic comments on trigger match.
- Schema (additive migration `20260926010000_hide_comment_action`):
  `ActionType.HIDE_COMMENT`. No new model — reuses the existing
  Action/dispatch/MessageLog pipeline exactly like REPLY_COMMENT/SEND_DM do.
- Backend: `ActionDto.payload` now also optional for `HIDE_COMMENT` (no
  message content of its own, same as `CONDITION`). `AutomationsService
  .dispatchAction` skips `HIDE_COMMENT` for STORY_REPLY/DM-sourced events
  (no comment to hide there — identical guard pattern to the existing
  REPLY_COMMENT skip) and builds a `content: {}` job. `MessagingService
  .callGraphApi` sends `POST /<recipientId>?hide=true` — a query param, not
  a JSON body field (verified against Meta's current docs, not guessed).
  4 new tests (2 dispatch, 2 messaging-service request-shape/rejection).
- Frontend: `HIDE_COMMENT` added to the action-step editor's step-type
  picker; the message textarea is replaced with a plain explanatory note for
  this step type (no text to write — nothing was sent). `serializeAction
  Steps`/`deserializeActionSteps`/`validateActionSteps` all updated to treat
  `HIDE_COMMENT` as payload-less, alongside `CONDITION`.
- **Explicitly out of scope, documented per CLAUDE.md §14 (not silently
  missing):** no manual "unhide" button or moderation-inbox UI — this
  milestone is auto-hide-via-automation only. A full comment-moderation
  dashboard (browse/unhide previously-hidden comments) is a different,
  separably-scoped feature not requested yet.
- Verified end-to-end via headless Playwright against the real local
  API/DB: created a HIDE_COMMENT automation through the real builder UI
  (step-type switch correctly hides the message field), confirmed it
  persists with `payload: null`, confirmed the edit page prefills and
  round-trips it correctly, and cleaned up via the real delete flow (204).
  The actual Graph API request shape (`POST .../<id>?hide=true`) is proven
  correct at the unit level (mocked fetch asserts the exact URL) rather
  than against a live account, matching how REPLY_COMMENT/SEND_DM were
  originally verified when first built — the local test Instagram account
  only has a dummy token, so a live Graph call would only prove the
  (expected) auth failure, not add confidence about request correctness.
- 159/159 backend tests, clean `tsc`/lint on both apps (api: 145
  pre-existing `any`-in-test warnings, +2 for the new test files, 0 errors;
  web: 0 errors, 1 pre-existing unrelated warning).
- Deployed via `infra/scripts/deploy.sh` (`c664938` → `5e0c08f`), the
  `HIDE_COMMENT` migration applied cleanly (`20260926010000_hide_comment_action`),
  health check clean, no errors in live api/worker logs post-restart.

**Real production incident, same day (user, 2026-09-23): "@orincore.official
shows as RATE_LIMITED" — plus two genuinely missing Accounts-page features
(profile preview/caching, unlink). All three fixed and shipped together
since they touch the same page/module.**
- **Root cause, more severe than a display bug**: `CircuitBreakerService
  .recordFailure` correctly flags an account `RATE_LIMITED` after 5
  consecutive send failures, but `InstagramService.getSendCredentials`
  treated `RATE_LIMITED` the same as `DISCONNECTED`/`TOKEN_EXPIRED` and
  refused to return credentials for it. Since a send can only reach
  `MessagingService.callGraphApi` (and therefore
  `CircuitBreakerService.recordSuccess`, the only thing that resets status
  back to `ACTIVE`) after `getSendCredentials` succeeds, this was a genuine
  **permanent deadlock**: once RATE_LIMITED, an account could never send
  again, ever, irrespective of how much time passed or how many later
  sends would have actually succeeded. Root-caused by reading the full
  credential-gating chain end to end, not by guessing from the symptom.
  Fixed two ways: (1) `getSendCredentials` no longer blocks `RATE_LIMITED`
  — that state is meant to be temporary/self-healing, already correctly
  gated by `CircuitBreakerService.isOpen()` earlier in the send path; (2)
  `recordSuccess` no longer gates its `ACTIVE` reset on `isOpen()` still
  being true (it raced against the open key's own 5-minute TTL and reliably
  missed), it now always resets — safe because `setAccountStatus` is
  already a no-op write when the status already matches. 6 new regression
  tests (`getSendCredentials` per status, `recordSuccess` unconditional
  reset).
- **Profile preview + caching** (the "save data to database so no need to
  ping the API again and again" ask): new nullable `InstagramAccount`
  columns (`displayName`, `profilePictureUrl`, `followersCount`,
  `profileSyncedAt`, migration `20260927010000_instagram_profile_preview`).
  Populated once at connect time (`handleCallback`, extended `/me` fields
  request — `profile_picture_url`/`followers_count`, confirmed against
  Meta's current IG User field reference, no extra permission needed) and
  refreshed opportunistically by the existing periodic token-refresh job
  (`refreshAccountToken` now also calls the new `syncProfile`, non-fatal on
  its own failure) — `listAccounts` never calls Meta live, only ever reads
  the cache. New on-demand `POST /instagram/accounts/:id/sync-profile` +
  a "Refresh profile" button per row for an immediate manual sync (e.g. for
  accounts connected before this shipped).
- **Unlink/disconnect** (previously did not exist at all — not a bug, a
  gap): new `InstagramService.disconnectAccount` marks the account
  `DISCONNECTED` + stamps `disconnectedAt` rather than hard-deleting the
  row — a real delete would cascade-destroy every automation/comment
  event/message log/contact tied to it (schema `onDelete: Cascade`), which
  "disconnect" should not silently do. `listAccounts` now excludes
  `DISCONNECTED` so it actually disappears from the Accounts page;
  reconnecting the same Instagram account later re-upserts by
  `igBusinessId` and clears it automatically. New `DELETE
  /instagram/accounts/:id` (`@HttpCode(204)` from the start — the same
  missing-204 bug class fixed earlier this session was checked for here
  proactively, not repeated). Frontend: a disconnect icon button with a
  native `window.confirm` step (no dialog primitive exists yet in
  `components/ui/`; not worth building one for a single confirm).
- Frontend Accounts page rebuilt to render the preview (avatar with a
  graceful icon fallback when no picture is cached, follower count,
  human-readable status labels instead of raw enum values like
  `RATE_LIMITED`) and the two new per-row actions.
- 171/171 backend tests, clean `tsc`/lint on both apps. Verified end-to-end
  against the real local API/DB: reproduced the exact stuck state (forced
  an account to `RATE_LIMITED`), confirmed `sync-profile` now reaches the
  decrypt step instead of being blocked by status (proven live via the
  server's own error log, not just unit tests), confirmed the disconnect
  button's confirm-then-remove flow round-trips correctly and the account
  row is preserved as `DISCONNECTED` in Postgres rather than deleted.
- Not yet deployed to the VPS.

**Milestone 6 — Interactive DM buttons + require-follow gating: ✅ done,
verified locally, pending VPS deploy (user directive, 2026-09-23).**
- **User-reported gap, not a bug**: "buttons" on a SEND_DM were never real
  interactive buttons — `MessagingService` flattened them to plain text
  links (`renderContentText`'s own comment said the Button Template shape
  "isn't verified against Meta's current docs"). The user's actual desired
  flow (comment → DM with buttons → tap unlocks content, gated behind
  following the account) needed real Meta button/postback support, which
  didn't exist. Verified all of the following against Meta's live docs
  before writing code (multiple prior sessions in this project got Graph
  API specifics wrong by guessing):
  - Button Template (`instagram-api-with-instagram-login/messaging-api/
    button-template`): `message.attachment.type=template`,
    `payload.template_type=button`, up to 3 buttons, each `web_url` or
    `postback`. Confirmed for Convozy's actual flow (graph.instagram.com,
    Instagram User access token) — not the Facebook-Login-specific variant
    this project deliberately doesn't use.
  - `messaging_postbacks` webhook field + payload shape
    (`entry.messaging[].postback.{mid,title,payload}`).
  - Follow-check: `GET /<IGSID>?fields=is_user_follow_business`, confirmed
    on the Instagram-Login-specific User Profile API page (graph.instagram.com,
    same permissions already granted — `instagram_business_basic` +
    `instagram_business_manage_messages`, no extra scope). Consent is
    satisfied by the time this fires (a postback tap only happens inside a
    DM thread the business already opened).
  - **Scoping decision, asked and confirmed with the user before building**:
    a purpose-built two-outcome button model (optional require-follow +
    an "unlocked" message + a "locked" message), not a fully general
    branching-into-the-button system. Smaller surface, matches the exact
    described flow, ships in one pass.
  - **Documented, unresolved uncertainty**: Button Template messages are
    only fully verified for `recipient.id` (conversation-based) sends.
    Meta's Private Replies doc (comment-triggered `recipient.comment_id`)
    only shows a plain-text message body, never an attachment/template
    example. Sent anyway using the same best-verified `message.*` shape,
    with a code comment flagging it and instructions to watch MessageLog
    for a Graph API rejection there specifically — the existing
    error-handling pipeline already surfaces any such failure visibly
    (FAILED status + real errorCode in Activity), never silently.
- Backend: `ActionButtonDto` extended (`type: WEB_URL|POSTBACK`,
  `requireFollow`, `unlockedText`, `lockedText`; `payload` never trusted
  from the client). `AutomationsService.createActionTree` does a two-step
  write for POSTBACK buttons — the payload string
  (`${actionId}:${buttonIndex}`) can only be assigned once the action row
  exists, so it can never be forged to resolve to another workspace's
  action. New `resolvePostback` decodes the payload, loads the Action
  (cross-checked against the account the postback arrived on), checks
  follow status only if gated, and enqueues the resolved reply. New
  `InstagramService.checkIsFollowing` (fails closed to not-following on any
  error). New `postback-events` queue/processor (webhook response must stay
  fast — the follow-check is an async Graph call, so it can't happen inline
  in the webhook handler). `MessagingService` now sends a real Button
  Template (`buildMessageBody`) instead of flattening to text.
  `WEBHOOK_SUBSCRIBED_FIELDS` includes `messaging_postbacks`. 15 new
  backend tests across 4 files.
- Frontend: SEND_DM steps get a real button editor (title, type, link OR
  require-follow toggle + two customizable message fields — matches the
  user's explicit "all messages should be customizable"), up to 3 per
  message, full client-side validation mirroring the backend DTO.
- Verified end-to-end against the real local API/DB **and** the real
  worker process (not just unit tests): created a button through the
  actual builder UI, confirmed the server-generated postback payload
  persisted correctly, confirmed it survives an edit-resave (new action id,
  freshly regenerated payload string), and sent a real HMAC-signed
  `messaging_postbacks` webhook payload through the live local API —
  confirmed via worker logs that it was correctly routed to the postback
  pipeline (not the comment/DM one), decoded, resolved to the right action,
  and reached the follow-check step (only failing there because the local
  test fixture's token is a deliberate dummy value, the same expected
  failure mode already established for the RATE_LIMITED fix's live tests).
- 189/189 backend tests, clean `tsc`/lint on both apps.
- Deployed via `infra/scripts/deploy.sh` in two passes: `a610931` →
  `67ecaa4` (the feature itself, no migration — nothing in this
  milestone touched Prisma schema), then `67ecaa4` → `212c0a8` (a real
  gap found immediately after the first deploy: `subscribeToWebhooks`
  only ever ran once, at connect time, so any account connected before
  today — including the real `@orincore.official` account — was never
  actually subscribed to `messaging_postbacks` and would never receive
  button taps. Fixed by also re-subscribing inside `syncProfile`, the
  already-shipped on-demand "Refresh profile" action. **Action needed
  from the user**: click "Refresh profile" once on each existing
  connected account (Accounts page) so it picks up the new webhook
  field — new connects/reconnects get it automatically.
- Both health checks clean post-deploy; worker logs confirm no errors.

**Follow-up, same day (user, 2026-09-23): "allow sending media files, voice
notes, and other things" — DM messages were text/link-only.**
- Verified against Meta's Instagram-Login Send Messages doc: `message
  .attachment` supports `type: image|video|audio|file` with `payload.url` —
  same `/messages` endpoint already in use, no new permissions. "Voice
  notes" map to the `audio` type (Meta documents no separate voice-note
  attachment type). A message is one of: text, a Button Template, or a
  media attachment — never combined in one Graph API call, so media and
  buttons are mutually exclusive on the same action (enforced at write
  time, not just in the UI).
- **Storage, confirmed with the user before building**: Cloudflare R2
  (S3-compatible), not local VPS disk — avoids any Nginx/Docker-volume
  changes. Objects live under `workspaces/<workspaceId>/<type>/<uuid>.<ext>`
  on the user's own `convozy` bucket (custom domain
  `convozy.media.orincore.com`, public access enabled — required, since
  Meta's servers fetch the URL directly to deliver the message).
- Backend: new `media` module (`MediaService`/`MediaController`,
  `POST /media/upload`, multipart via multer + `@aws-sdk/client-s3`).
  Validates against Meta's own real per-type caps at upload time (image
  8MB; video/audio/file 25MB) and only Meta-documented formats (PNG/JPEG/
  GIF, MP4/OGG/WEBM/MOV/AVI, AAC/M4A/WAV, PDF) — rejected immediately with
  a clear message rather than accepted and failing later at send time. New
  `R2_*` env vars (optional at the schema level, like Stripe/Razorpay/AI —
  upload just becomes unavailable, not a boot failure, if unset).
  `ActionPayloadDto` gains `media` (mutually exclusive with `buttons`,
  makes `text` optional — Meta's raw attachment send has no caption field).
  `MessagingService.buildMessageBody` sends the attachment shape when
  `media` is set. 12 new backend tests (media service upload/validation,
  send-time body shape, write-time mutual-exclusivity/SEND_DM-only checks).
- Frontend: SEND_DM steps get an "Attach a file" control (hidden once
  buttons exist, and vice versa) — upload progress, inline error, and a
  preview card (icon by type, filename, size) once attached, with a plain
  remove action.
- Verified end-to-end against the **real** R2 bucket (not mocked) — a real
  file uploaded through the real local API, confirmed reachable over HTTPS
  at its public URL (what Meta's servers would fetch), the automation
  created and edited through the real builder UI with the attachment
  correctly hidden/shown alongside the text and buttons sections, and the
  persisted payload shape confirmed directly in Postgres.
- 201/201 backend tests, clean `tsc`/lint on both apps.
- Deployed via `infra/scripts/deploy.sh` (`212c0a8` → `664ad61`), R2
  credentials added to the VPS `.env` first (backed up before editing).
  Verified live in production, not just health-checked: a real upload
  through the live API, confirmed publicly reachable over HTTPS at its
  R2 URL.

**Milestones 7–10 (sequences, broadcasts, external-request step, analytics)**:
not started, full detail in the plan file (needs a light update to reflect
the Milestone 4/6 rescoping — Follow-to-DM stays dropped, no Meta webhook/
endpoint exists for it). Building **one at a time**.

## Phase 6 — AI features

- ☐ `AiProvider` interface + first implementation
- ☐ Intent classification trigger type (`ai_intent`)
- ☐ AI-drafted reply action type
- ☐ Smart FAQ automation template
- ☐ Per-workspace AI usage tracking

## Phase 7 — SEO & marketing site content

- ☐ Homepage (SSR, full metadata + JSON-LD `Organization`/`SoftwareApplication`)
- ☐ Feature pages targeting real keyword intent (auto reply tool, comment-to-DM
  automation, ManyChat alternative for Instagram, etc.)
- ☐ Pricing page with `Product`/`Offer` JSON-LD
- ☐ Blog scaffold (`Article` JSON-LD, SSR/SSG)
- ☐ Breadcrumbs (visible + `BreadcrumbList` JSON-LD) on every non-home route
- ☐ Sitemap/robots verified against real deployed routes
- ☐ Core Web Vitals check on marketing pages (Lighthouse in CI)

## Phase 8 — Observability & scaling hardening

- ☐ Structured logging with correlation IDs across API + worker
- ☐ Metrics (queue depth, send success rate, per-account rate-limit hits)
- ☐ Error tracking (Sentry or equivalent)
- ☐ Load test the webhook → send pipeline at target concurrency
- ☐ Runbooks for on-call scenarios (DLQ growth, account throttled, DB failover)

## Phase 9 — Launch

- ☐ Meta App Review submission (production scopes)
- ☐ Production VPS provisioning + `docker-compose.prod.yml` deploy
- ☐ Domain + TLS live
- ☐ Free tier + paid tier live in production billing
- ☐ Post-launch monitoring checklist

---

## Risks / known unknowns

- Meta App Review approval timeline for messaging/comment-management scopes is
  outside our control and can gate real end-to-end testing.
- Instagram Graph API rate limits and exact webhook field availability
  (live_comments, story replies) should be re-verified against current Meta docs
  before Phase 1 implementation — Meta changes these periodically.
- "Free with minimal charges" sustainability depends on actual Graph API call
  volume vs. VPS cost — worth instrumenting usage early (Phase 8 metrics) to
  validate the free-tier limit chosen in Phase 5.
