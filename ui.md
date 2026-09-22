# ui.md — Dashboard page inventory (ManyChat-sourced, built in Convozy's own theme)

> Research pass, 2026-09-23. Goal: catalog every distinct **page/section** ManyChat's
> logged-in dashboard has, so Convozy builds the equivalent *page inventory* — not the
> same visuals. Convozy's UI is a **locked dark monochrome theme** (CLAUDE.md §12a) —
> nothing here means copying ManyChat's colors, layout, or component style. This is a
> map of *what pages should exist*, not *what they should look like*.
>
> Sourced from ManyChat's own resource/tutorial pages where fetchable, plus
> third-party reviews where ManyChat's own site blocked direct fetches (see Sources
> at the bottom). Cross-reference `MANYCHAT_FEATURE_AUDIT.md` for the feature-level
> detail behind each page — this file is the page/navigation-level view, that file is
> the feature-level view.

---

## 1. ManyChat's dashboard page inventory

| Page | What it does | Notes |
|---|---|---|
| **Home / Overview** | Landing page after login — bot overview, connected-channel summary, getting-started tips | First thing a new user sees |
| **Automation (Flow Builder)** | Primary workspace — flows organized into folders, visual drag-and-drop flow canvas, trigger + step configuration | ManyChat's core product surface |
| **Contacts (Audience)** | Full contact list — chat history per contact, custom fields, tags, segments | Foundational for targeted sends |
| **Live Chat (Inbox)** | Unified inbox — manual human takeover of bot conversations across every connected channel | Requires a team/seat concept |
| **Broadcasting** | One-to-many sends — broadcasts, sequences (drip campaigns), rule-based scheduled sends to filtered contact segments | |
| **Growth Tools** | Acquisition surface — Ref URLs, QR codes, Ads "JSON" click-to-bot triggers, landing pages, website widgets, Comments Growth Tool | Marketing/acquisition, not core automation |
| **Analytics (Insights)** | Contact growth over time, per-channel metrics, flow/automation performance, conversion events, agent activity | |
| **Templates** | Marketplace of pre-built flow templates, installable into a workspace | |
| **Settings** | Account + bot configuration hub — sub-areas below | |
| ↳ Settings → **Profile / Account** | User identity, password, connected login methods | |
| ↳ Settings → **Billing / Plan** | Current plan, usage against plan limits, upgrade/downgrade, payment method | |
| ↳ Settings → **Team / Roles** | Invite teammates, assign Owner/Admin/Editor/Inbox-Agent roles (Agency-tier: multi-client management) | |
| ↳ Settings → **Channels** | Connect/disconnect Instagram, Messenger, Telegram, TikTok, WhatsApp, SMS, Email | |
| ↳ Settings → **Integrations** | Zapier, Google Sheets, Make/Integromat, and other third-party connectors | |
| ↳ Settings → **Dev Tools / API** | API token issuance, webhook-out configuration, rate-limit visibility | |

---

## 2. Convozy's current logged-in pages (as of 2026-09-24)

Only **3 top-level pages** exist today, per `apps/web/src/components/dashboard/shell.tsx`'s
`NAV_ITEMS`:

1. `/app` — **Accounts** (connect/view Instagram accounts — this is also today's de facto "home")
2. `/app/automations` (+ `/app/automations/new`) — **Automations** (the flow/trigger/action builder — now gaining condition/branching, Milestone 1)
3. `/app/activity` — **Activity** (flat live feed of comment events + sends, no aggregation)

There is **no Settings, Profile, Billing, Contacts, Broadcasting, Growth Tools,
Analytics, Templates, or Team page at all** — everything below "3. Gap analysis" is
either already scoped in the existing feature-parity plan
(`/Users/orincore/.claude-client1/plans/vectorized-growing-perlis.md`) or is a newly
surfaced gap this file exists to record.

---

## 3. Gap analysis — ManyChat page → Convozy status

| ManyChat page | Convozy equivalent | Status |
|---|---|---|
| Home / Overview | `/app` (Accounts) doubles as home today | Adequate for now — a dedicated Overview/dashboard-summary page is a nice-to-have, not urgent, since account count is low per workspace |
| Automation (Flow Builder) | `/app/automations` | ✅ Have (form-based, not drag-and-drop canvas) — gaining condition/branching now (Milestone 1 of the feature-parity plan) |
| Contacts (Audience) | *(none)* | Planned — Milestone 2 of the feature-parity plan (tags, custom fields, segments) |
| Live Chat (Inbox) | *(none)* | **Not planned** — needs a team/multi-seat concept Convozy doesn't have; explicitly deferred per `MANYCHAT_FEATURE_AUDIT.md` §10 |
| Broadcasting | *(none)* | Planned — Milestone 8 |
| Growth Tools | *(none)* | Planned — Milestone 4/6 (scoped to what Meta's API actually supports; see the feature-parity plan's feasibility findings) |
| Analytics (Insights) | `/app/activity` is a flat feed, not aggregated analytics | Planned — Milestone 10 |
| Templates | *(none)* | Planned — Milestone 3 (folds into the `/app/automations/new` picker, not a separate top-level page) |
| Settings → Profile/Account | *(none)* | **New gap, not in the existing 10-milestone plan — see §4** |
| Settings → Billing/Plan | *(none)* | **New gap** — `billing` module/`EntitlementsService` exists server-side (this session), but there is no UI for a user to see their plan/usage at all |
| Settings → Team/Roles | *(none)* | Not planned — same reason as Live Chat (no multi-seat concept yet) |
| Settings → Channels | Folded into `/app` (Accounts) today | Adequate — Convozy's single-channel-first (Instagram) focus makes a separate "Channels" settings page premature |
| Settings → Integrations | *(none)* | Not planned — `MANYCHAT_FEATURE_AUDIT.md` §12 ranks this low-priority |
| Settings → Dev Tools/API | *(none)* | Not planned — audit doc flags a public API as a real long-term differentiator but explicitly "after the core product," not now |

---

## 4. New gap surfaced by this research: Profile / Account / Billing settings

The one genuine, previously-unscoped gap this research surfaces: **Convozy has no
Settings/Profile page of any kind.** A user can register, log in, connect Instagram,
and build automations — but has no page to see their own email, change their
password, see what plan they're on, or see usage against `Plan.monthlySendLimit`
(a value `EntitlementsService`/`Plan` already models server-side, per this session's
entitlements work, with nothing exposing it in the UI).

This should be added to the feature-parity plan's milestone sequence — **not built in
this session without the user confirming where it slots in relative to the existing
10 milestones** (per CLAUDE.md §13's phase discipline and this session's explicit
"one feature at a time" instruction). Recorded here so it isn't silently lost.

A reasonable minimal-first-pass scope, when it's picked up:
- `/app/settings` (or `/app/settings/profile`) — name, email (read-only or
  change-password flow), connected login methods (Google vs. password)
- `/app/settings/billing` — current plan name, `monthlySendLimit`/usage-this-period
  (reading from `UsageRecord`), upgrade CTA (no real Stripe/Razorpay checkout yet —
  that's Phase 5, not built)
- Both built with the same three-way loading/error/empty-state pattern and
  `lib/api.ts` namespace-object convention already established (see
  `automations/page.tsx` for the pattern to copy), in the locked dark monochrome
  theme, with a `taste-skill` pass per CLAUDE.md §12 since it's new page composition.

---

## 5. Theme note (non-negotiable, applies to every page in this file)

Every page built from this inventory uses Convozy's **existing, locked** design
system — CLAUDE.md §12a/§12b, `apps/web/src/app/globals.css`'s token set, the
`components/ui/` primitives already in the repo (extending them, not replacing them).
Nothing in this file is a visual reference. ManyChat's actual colors, iconography,
spacing, or component style are irrelevant and must not leak into Convozy's UI —
only the *page inventory and what each page is for* is being borrowed.

---

## Sources

- [Understanding the Manychat Dashboard — ManyChat](https://manychat.com/resources/video-course/how-to-navigate-through-manychat/understanding-the-manychat-dashboard)
- [How to Navigate Through Manychat — ManyChat](https://manychat.com/resources/video-course/how-to-navigate-through-manychat/how-to-navigate-through-manychat)
- [Flow Builder Basics — ManyChat](https://manychat.com/resources/video-course/how-to-navigate-through-manychat/flow-builder-basics)
- [Every Growth Tool Explained — ManyChat](https://manychat.com/blog/growth-tools/)
- [Honest Manychat Review After 6+ Years — Chatimize](https://chatimize.com/reviews/manychat/)
- [Full ManyChat Review 2026 — GPTBots](https://www.gptbots.ai/blog/manychat-review)
- [ManyChat FAQ 2026 — ManyChat Community](https://community.manychat.com/general-q-a-43/manychat-faq-everything-you-need-to-get-started-in-2026-8982)
- Cross-referenced against this repo's own `MANYCHAT_FEATURE_AUDIT.md` (2026-09-23) for feature-level detail behind each page.
