# ManyChat Feature Audit — for Convozy planning

> Research pass, 2026-09-23. Goal: catalog everything ManyChat sells, mark what's
> free vs. paid (and at which tier) on **their** side, so we can decide what
> Convozy builds and — per the product's whole premise (CLAUDE.md §1) — which of
> it we can offer for free where ManyChat charges. Sourced from ManyChat's own
> help center where fetchable, plus third-party pricing breakdowns where
> ManyChat's site blocked direct fetches (see Sources at the bottom of each
> section). Numbers are current as of ManyChat's March 2026 pricing overhaul —
> re-verify before quoting these publicly, pricing pages change.

---

## 1. Pricing tiers (their side, for reference — NOT what Convozy should copy)

ManyChat moved from a 2-tier (Free/Pro) to a 5-tier model on 2026-03-02. Prices
below are **monthly** billing; annual billing is 18-30% cheaper than the
month-to-month rate shown here.

| Plan | Monthly price | Contacts | Channels | User seats | Inbox seats | Overage |
|---|---|---|---|---|---|---|
| Free | $0 | 25 active contacts | 2 (IG, Messenger, Telegram, TikTok — pick 2) | 1 | — | n/a, hard-capped |
| Essential | $17 | 250 | 2 | 2 | — | $0.10/contact |
| Pro | $39 | 2,500 | 3 | 3 | 2 | $0.05/contact |
| Business | $99 | 7,500 | Unlimited | 5 | 3 | $0.025/contact |
| Advanced | $199 | 25,000 | Unlimited | 10 | 5 | custom |

Notes:
- "Active contact" = anyone who interacted with an automation in the billing
  month, regardless of message count.
- WhatsApp, SMS, and Email are **only unlocked from Pro up** — Free and
  Essential are Instagram/Messenger/Telegram/TikTok only.
- The ManyChat AI add-on is **+$29/month on top of any plan**, or bundled into
  a separate invite-only "Elite" tier.
- WhatsApp also carries a **Meta-side per-template-message fee** on top of the
  ManyChat subscription (~$0.025/message in the US, varies by country) — this
  is a Meta cost, not a ManyChat markup, and Convozy would face the identical
  cost structure if/when it adds WhatsApp (see ARCHITECTURE.md).

Sources: [SetSmart pricing breakdown](https://setsmart.io/blog/manychat-pricing), [ChatBot.com pricing analysis](https://www.chatbot.com/blog/manychat-pricing/), [FlowGent pricing guide](https://flowgent.ai/blog/manychat-pricing)

---

## 2. Channels

| Channel | Free? | Paid tier required | Notes |
|---|---|---|---|
| Instagram (comments, DMs, story replies) | ✅ Free (counts as 1 of 2 free channel slots) | — | Convozy's current core focus |
| Facebook Messenger | ✅ Free | — | |
| Telegram | ✅ Free | — | |
| TikTok (DM + comment-to-DM) | ✅ Free | — | Business account required on TikTok's side; EU/UK users currently can't connect (TikTok-side restriction, not ManyChat) |
| WhatsApp | ❌ | Pro ($39/mo)+ | Plus Meta's per-template-message fee |
| SMS | ❌ | Pro ($39/mo)+ | Carrier costs apply on top |
| Email | ❌ | Pro ($39/mo)+ | |

**Free tier only gets 2 of the 4 free channels active simultaneously** — e.g. you
can run Instagram + Messenger, but not Instagram + Messenger + Telegram, without
upgrading.

Sources: [ManyChat FAQ 2026](https://community.manychat.com/general-q-a-43/manychat-faq-everything-you-need-to-get-started-in-2026-8982), [ManyChat TikTok connect guide](https://help.manychat.com/hc/en-us/articles/17928990909084-How-to-connect-TikTok-to-Manychat)

---

## 3. Instagram-specific features (most relevant to Convozy today)

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Comment → DM automation (keyword-triggered) | ✅ Free | — | Convozy already has this (Phase 2) |
| Post-level scoping (choose which posts trigger) | ✅ Free | — | Convozy already has this |
| Story reply automation | ✅ Free | — | Convozy already has this |
| Live comment automation | ✅ Free | — | Convozy: not yet built |
| "Comments Growth Tool" (auto-follow-back / grow followers from comments) | ✅ Free | — | Convozy: not built |
| Follow to DM ("say hi to new followers") | ✅ Free (Beta, needs ~1,000+ followers to be eligible) | — | Distinct from comment automation — triggers on a *new follow* event, not a comment. Requires Meta eligibility, not just a ManyChat tier |
| Require-follow gating before replying | Free | — | Gate a flow behind "must follow the account first" |
| Unified inbox (manual reply alongside automations) | ✅ Free (1 seat) | More seats: Pro+ | |
| Broadcasts to Instagram subscribers | ❌ | Pro+ | One-to-many scheduled/manual sends outside the 24h window rules |

Sources: [ManyChat key Instagram features guide](https://manychat.com/blog/key-instagram-automation-features/), [Follow to DM FAQ](https://community.manychat.com/general-q-a-43/follow-to-dm-faq-everything-you-need-to-know-9214), [Comments Growth Tool](https://help.manychat.com/hc/en-us/articles/20310878273692-Quick-Automation-Grow-followers-from-comments)

---

## 4. Flow Builder (automation engine)

| Feature | Free? | Paid tier | Convozy equivalent |
|---|---|---|---|
| Visual drag-and-drop builder | ✅ Free | — | Not built — dashboard currently uses a form-based automation editor (Phase 2/4), not a visual canvas |
| Send Message step | ✅ Free | — | ✅ Have (SEND_DM, REPLY_COMMENT actions) |
| Condition / branching step | ✅ Free | — | ❌ Not built — automations currently match-then-dispatch linearly, no branching logic |
| Smart Delay (duration or specific date/time) | ✅ Free | — | Partial — we have `delaySeconds` per action, not date-targeted delay |
| Random Flow / Randomizer (A/B split traffic) | ✅ Free | — | ❌ Not built |
| Start Another Flow (sub-flow composition) | ✅ Free | — | ❌ Not built |
| External Request (outbound webhook/HTTP step, maps JSON response into fields) | ❌ | Pro+ | ❌ Not built — high value for creators wanting to pull data from their own systems |
| Dynamic Content (server decides what a flow shows) | ❌ | Pro+ | ❌ Not built |
| Multiple actions per trigger, ordered/sequenced | ✅ Free | — | ✅ Have (`Action.order`) |
| Unlimited automations | Free: capped at ~4; unlimited from Essential ($17)+ | Essential+ | ✅ Convozy: no artificial cap currently |

Sources: [ManyChat automation guide](https://help.manychat.com/hc/en-us/articles/14281166306332-How-to-build-a-Manychat-automation), [Smart Delay docs](https://help.manychat.com/hc/en-us/articles/14281197046812-Smart-Delay), [External Request docs](https://community.manychat.com/general-q-a-43/external-request-5586)

---

## 5. Growth tools (acquisition / lead capture, outside the DM/comment flow itself)

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Facebook/Instagram Ads "JSON" quick-reply trigger (click-to-Messenger ads) | ❌ | Pro+ | Ad click opens directly into a flow |
| Landing page builder (hosted, publish in minutes) | Free tier: limited | Full: paid tiers | |
| Website widgets (chat bubble, box, modal/overlay popup) | Free tier: limited | Full: paid tiers | Embeddable on the creator's own site |
| Messenger/Instagram Ref URLs (a link that opens the app + starts a flow) | ✅ Free | — | |
| QR codes into a flow | ✅ Free | — | |
| Comments Growth Tool 2.0 (react to ad comments, not just clicks) | ❌ | Pro+ | |

Convozy has none of these today — they're all acquisition/marketing surface, not
core to the comment→DM pipeline, but they're a big part of why creators pay for
ManyChat (it's a full "grow my audience" toolkit, not just automation).

Source: [Every Growth Tool Explained — ManyChat blog](https://manychat.com/blog/growth-tools/)

---

## 6. Broadcasting & sequences

| Feature | Free? | Paid tier | Convozy equivalent |
|---|---|---|---|
| One-to-many broadcast (manual or scheduled) | ❌ | Pro+ | ❌ Not built |
| Sequences (drip campaign — timed series of messages after a trigger) | ❌ | Pro+ | ❌ Not built (delaySeconds gives single-step delay only, not multi-step drip) |
| RSS-feed-triggered broadcasts | ❌ | Pro+ | ❌ Not built |

---

## 7. Segmentation

| Feature | Free? | Paid tier | Convozy equivalent |
|---|---|---|---|
| Tags | ✅ Free | — | ❌ Not built |
| Custom fields (system + user-defined) | ✅ Free | — | ❌ Not built |
| Segments built from tags/fields, reusable | ✅ Free | — | ❌ Not built |

This is foundational for a lot of other features (targeted broadcasts, smarter
matching, personalization) — worth prioritizing before broadcasts/sequences
since those depend on it.

Source: [Creating Customer Segments — ManyChat blog](https://manychat.com/blog/customer-segments/)

---

## 8. AI features

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Intention Recognition (route a message to the right flow based on intent) | ❌ | **+$29/mo add-on** on any paid plan, or Elite (custom) | |
| AI Step (conversational, in-flow reply generation) | ❌ | +$29/mo add-on | Reviewers describe it as "closer to keyword matching than real conversational AI" at this price point — doesn't hold context across a conversation |
| AI Replies (auto-reply to DMs using site/business info as context) | ❌ | +$29/mo add-on | |
| AI Comments (auto-reply to comments matching the creator's past reply style) | ❌ | +$29/mo add-on | |
| AI Goals (follow up after an AI reply/comment toward a specific outcome) | ❌ | +$29/mo add-on | |
| Flow Builder Assistant (AI suggests flow steps/copy while building) | ❌ | +$29/mo add-on | |

**This is ManyChat's single weakest area per multiple 2026 reviews** — flat
$29/mo tax on top of a paid plan, and the reviews consistently call the actual
AI quality out as shallow. Convozy's CLAUDE.md §7 AI plan (opt-in per
automation, provider-agnostic interface, async via its own queue) is already
architected to do this properly and cheaply — this is a real opportunity, not
just a checkbox to match.

Sources: [Manychat Review 2026 — Voiceflow](https://www.voiceflow.com/blog/manychat), [Manychat Review 2026 — FlowGent (Weak AI callout)](https://flowgent.ai/blog/manychat-review), [Manychat Review 2026 — Featurebase](https://www.featurebase.app/blog/manychat-pricing)

---

## 9. E-commerce (Shopify)

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Shopify connect (order/product data into flows) | Needs Pro+ (External Request/Dynamic Content are Pro-gated, and most Shopify flows lean on those) | Pro+ | |
| Abandoned cart recovery (SMS/DM sequence) | ❌ | Pro+ | Needs SMS or a paid channel anyway |
| Order confirmation / fulfillment triggers | ❌ | Pro+ | |
| Product recommendation flows | ❌ | Pro+ | |

Out of scope for Convozy's current phase (TRACKER.md has no e-commerce phase
yet) — noting it here for completeness, not recommending it now.

---

## 10. Team / Inbox / roles

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Unified inbox (manual takeover of automated conversations) | ✅ Free (1 seat) | More seats: Pro+ | |
| Role-based permissions: Owner, Admin, Editor, Inbox Agent | ✅ Free (limited seats) | More seats: Pro+ | |
| Conversation assignment (route to a specific team member) | ❌ | Business+ | |
| Shared team inbox at scale | ❌ | Business+ | |

Convozy currently has no multi-user/team concept at all (single owner per
workspace) — reasonable to defer until there's user demand, but worth flagging
as a real gap vs. ManyChat once Convozy has agency-style or team customers.

Source: [User roles and team management — ManyChat Help](https://help.manychat.com/hc/en-us/articles/14281172274460-User-roles-and-team-management)

---

## 11. Analytics

| Feature | Free? | Paid tier | Convozy equivalent |
|---|---|---|---|
| Basic flow/automation performance stats | ✅ Free | — | ❌ Convozy has an activity feed (Phase 4) but no aggregate analytics/reporting yet |
| A/B test results (via the Randomizer) | Tied to Randomizer, which is free | — | ❌ Not built (no Randomizer equivalent) |

---

## 12. Integrations & public API

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Zapier / Make / Integromat connectors | Free tier: some; full: paid tiers | Varies | Third-party-hosted, not ManyChat's own cost really |
| Google Sheets integration | Pro+ (via External Request/Dynamic Content) | Pro+ | |
| Public API + API token issuance | ❌ | Pro+ | "Pro-and-up capability, not a free-tier one" per third-party analysis |
| External Request (webhook-out) | ❌ | Pro+ | Same gate as above |
| API rate limit | ~10 requests/sec per connected account (subscriber endpoints) | Same across paid tiers | Dev Tools request timeout hard-capped at 10s |

Convozy's own public API doesn't exist yet (not in TRACKER.md's current phases)
— worth a "Phase 10+" candidate once the core product is solid, and could be a
genuine free-tier differentiator (ManyChat gates *all* API access behind Pro).

Sources: [ManyChat API & Integration Limits — KlyoChat](https://klyochat.com/blog/manychat-api-limits), [Dev Tools: Basics — ManyChat Help](https://help.manychat.com/hc/en-us/articles/14281252007580-Dev-Tools-Basics)

---

## 13. Templates

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| Ready-to-Go flow templates (install pre-built automations) | ✅ Free | — | ❌ Convozy: not built — every automation is built from scratch today |
| Create/share a custom template with others | ✅ Free (Owner/Admin/Editor roles) | — | ❌ Not built |

Templates are a low-effort, high-perceived-value feature — a handful of
pre-built automation "starters" (e.g. "reply LINK to get my freebie", "comment
PRICE for pricing DM") would meaningfully lower the time-to-first-automation for
new Convozy users, which is a real onboarding win.

---

## 14. Agency / white-label

| Feature | Free? | Paid tier | Notes |
|---|---|---|---|
| True white-labeling (rebrand the product itself) | ❌ Not offered at any tier | n/a | ManyChat's own community moderators confirm this doesn't exist — agencies can only resell *implementation/management as a service*, not rebrand the platform |
| "For Agencies" program (multi-client management) | Paid tiers | Business/Advanced-ish | |

This is a genuine ManyChat gap. If Convozy ever wants to sell to
agencies/managers running automations for multiple creators, true
white-labeling (custom domain, logo, remove "powered by Convozy") is something
ManyChat structurally can't offer — worth remembering as a differentiator, not
an immediate build.

Source: [ManyChat White Label — is it available?](https://chatbotx.io/blog/manychat-white-label/)

---

## 15. Known ManyChat weaknesses (per multiple independent 2026 reviews)

These are places competitors and reviewers consistently ding ManyChat — i.e.
where "better than ManyChat" is a low bar, not just "free like ManyChat":

- **Free tier gutted in the March 2026 repricing** — dropped from 1,000 free
  contacts to 25. Reviewers call this the single biggest complaint of 2026.
  This is Convozy's most direct opening: staying meaningfully generous on the
  free tier is itself a differentiator now, not just a nice-to-have.
- **AI add-on is expensive and shallow** — $29/mo flat tax, doesn't hold
  conversation context, described as "closer to keyword matching."
- **No in-chat appointment booking** — must link out to Calendly or similar.
- **WhatsApp support is basic** — no team inbox/live handoff/CRM sync built
  in for WhatsApp specifically, unlike its Messenger/Instagram experience.
- **No true white-labeling**, even at the top tier.
- **Overage billing is a common complaint** — automations don't hard-stop at
  the contact cap, so costs creep upward without an explicit user decision to
  upgrade.

Sources: [Chatimize 6-year review](https://chatimize.com/reviews/manychat/), [FlowGent review](https://flowgent.ai/blog/manychat-review), [SetSmart automation review](https://setsmart.io/blog/manychat-automation)

---

## 16. Recommendations — what to actually build, and in what order

Not everything above is worth building. Ranked by (a) how core it is to the
comment-to-DM product promise, (b) how cheap it is to run given CLAUDE.md's
cost constraints, and (c) how directly it lets Convozy undercut ManyChat's
paid-only gates:

**High priority — core gaps, cheap to build, directly extend the existing engine:**
1. **Condition/branching step** in the automation engine — biggest functional
   gap vs. ManyChat's Flow Builder; everything else (sequences, smart delay by
   date, randomizer) builds on having branching first.
2. **Tags + custom fields + segments** — foundational for targeted sends later,
   and genuinely free to run (just more Postgres columns/tables, no new
   infrastructure cost).
3. **Pre-built templates** — cheap (just seed data + a picker UI), big
   onboarding win.
4. **Live comment automation** — same webhook pipeline as regular comments,
   incremental cost.
5. **Sequences (multi-step drip via delayed actions)** — natural extension of
   the existing `delaySeconds`/BullMQ delay mechanism already in place.

**Medium priority — real value, moderate build cost:**
6. **Broadcasts** — needs the segmentation work above first to be useful, plus
   careful rate-limit-aware fan-out (messaging module already owns per-account
   rate limiting, so this is an extension, not a new subsystem).
7. **External Request / outbound webhook step** — power-user feature, keep it
   opt-in and sandboxed (reuse the existing regex-timeout `vm` sandboxing
   pattern already established for triggers).
8. **Basic analytics dashboard** — aggregate what's already captured in
   CommentEvent/MessageLog rather than new data collection.

**Low priority / explicitly defer:**
9. Growth tools (landing pages, widgets, QR, ad-click JSON) — marketing
   surface, not core automation; revisit once the core engine has real
   differentiation.
10. Shopify/e-commerce — no signal of user demand yet, adds real scope.
11. Team roles/multi-seat — defer until there's a multi-person-workspace user.
12. Public API — valuable long-term (and a real "ManyChat charges for this,
    we don't" story) but should come after the core product, not before.
13. **True white-labeling for agencies** — differentiator to keep in back
    pocket, not a near-term build.

**Where "free" is the actual product decision, not just a phase**: segmentation,
condition/branching, sequences, live comment automation, and templates should
all ship on Convozy's free tier with no artificial gate — that directly
attacks ManyChat's most-criticized 2026 move (gutting the free tier to 25
contacts) and is cheap to run since none of it adds new paid infrastructure,
just more rows in Postgres and more BullMQ jobs on hardware Convozy already
pays for.
