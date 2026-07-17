# How the automated moderation system works, end to end

OpenChat classifies content with the OpenAI Moderation API instead of Modclub. Three paths feed
one set of moderation state: an always-on pipeline for public messages, a user-report flow, and
human verdicts in an internal moderation channel. The same state drives content gating in the
app-store builds.

Introduced across PRs [#9088](https://github.com/open-chat-labs/open-chat/pull/9088)–[#9096](https://github.com/open-chat-labs/open-chat/pull/9096). Last updated 2026-07-17.

## 1. The big picture

Every path ends in the same two kinds of state: **per-message moderation flags** stored in the
group/community canister that owns the message, and **sanctions** (message deletion, user
suspension) applied via `user_index`. The app-store frontend build reads the flags to hide
content; the web build shows everything.

```mermaid
flowchart LR
    subgraph entry [Entry paths]
        A[Active pipeline<br/>every public message]
        B[User report<br/>report_message]
        C[Moderator verdict<br/>internal channel]
    end
    L[local_user_index broker<br/>one per subnet]
    O[(OpenAI<br/>Moderation API)]
    F[(Per-message flags<br/>group / community canister)]
    S[Sanctions<br/>delete + suspend via user_index]
    M[Moderation channel<br/>ModerationReport messages]
    A --> L --> O
    L --> F
    B --> O
    B --> F
    B --> M
    B -- CSAM --> S
    A -- CSAM --> S
    C -- uphold --> S
    F --> G[App-store build hides content]
```

| PR | Layer | What it adds |
|----|-------|--------------|
| [#9088](https://github.com/open-chat-labs/open-chat/pull/9088) | BE | Expose community `moderation_flags` in `CommunitySummary` (+ updates), synced group_index → community |
| [#9089](https://github.com/open-chat-labs/open-chat/pull/9089) | BE | Group-level flags in `GroupSummary`, `set_group_moderation_flags`, flag-filtered group search |
| [#9090](https://github.com/open-chat-labs/open-chat/pull/9090) | BE | Per-message flag storage: `ModerationCategories` bitfield + `flag_message()` in chat events |
| [#9091](https://github.com/open-chat-labs/open-chat/pull/9091) | BE | Async pipeline classifying public messages via OpenAI on a timer |
| [#9092](https://github.com/open-chat-labs/open-chat/pull/9092) | BE | OpenAI classification in the report flow; Modclub fully removed; report rate limiting |
| [#9093](https://github.com/open-chat-labs/open-chat/pull/9093) | BE | CSAM escalation routing: group/community → group_index → user_index auto-sanction |
| [#9094](https://github.com/open-chat-labs/open-chat/pull/9094) | FE | App-store builds hide flagged communities, groups and messages |
| [#9095](https://github.com/open-chat-labs/open-chat/pull/9095) | BE/FE | `ModerationReport` message type + moderator verdict UI and endpoint |
| [#9096](https://github.com/open-chat-labs/open-chat/pull/9096) | dev | `OC_DEV_PORT` makes the dev server port configurable |

Merge order: #9090 → #9091 → #9092 → #9093 → #9095 are a stacked chain; #9088, #9089, #9094 and
#9096 sit directly on master.

## 2. Data model — two different "moderation flags"

Don't conflate them — they gate differently in the app-store build:

- **Message flags** — `ModerationCategories`, a `u32` bitfield of eight OpenAI-derived categories
  (bits 0–7), stored on the message inside the owning group/community canister. Every category is
  policy-violating, so the app-store build hides a message when *any* bit is set. An empty
  classification result still calls `flag_message` so stale flags clear when a flagged message is
  edited clean.
- **Group / community flags** — the pre-existing `ModerationFlags` enum (Adult, Offensive,
  UnderReview) set by platform moderators, now exposed on both `CommunitySummary` (#9088) and
  `GroupSummary` (#9089) and usable as a search filter. The app-store build hides a
  community/group only on `Adult | Offensive` — UnderReview must not hide anything.

### OpenAI category → bit mapping

| Category bit | OpenAI categories folded in | Outcome when reported |
|--------------|-----------------------------|-----------------------|
| `SEXUAL` | sexual | **flag only** — hidden in app store, no sanction |
| `SEXUAL_MINORS` | sexual/minors | **auto-sanction** — delete + indefinite suspension |
| `VIOLENCE` | violence | human review |
| `VIOLENCE_GRAPHIC` | violence/graphic | human review |
| `HARASSMENT` | harassment, hate | human review |
| `HARASSMENT_THREATENING` | harassment/threatening, hate/threatening | human review |
| `SELF_HARM` | self-harm, /intent, /instructions | human review |
| `ILLICIT` | illicit, illicit/violent | human review |

Unknown categories returned by OpenAI map to no flags and are logged (`category_to_flag` in
`backend/libraries/group_community_common/src/openai_moderation.rs`).

## 3. Active pipeline (#9091) — every public message gets classified

Classification is brokered by the `local_user_index` so that each subnet runs **one** OpenAI
client instead of one per chat canister. Sending or editing a message in a *public* group or
channel pushes a `ClassifyMessageRequest` to the local index over the existing (batched,
retrying) event sync channel. The broker queues it, classifies in batches on a timer, and routes
the result back as a `MessageClassified` event; the owning canister then stores the flags via
`flag_message` and fires the CSAM escalation if needed.

```mermaid
sequenceDiagram
    participant U as User
    participant G as group / community canister
    participant L as local_user_index (broker)
    participant O as OpenAI /v1/moderations
    U->>G: send_message / edit_message (public chat)
    G-)L: ClassifyMessageRequest (batched event sync)
    Note over L: per-source fair queue<br/>dedup by message id, caps 2k/source, 20k total
    loop timer, every 10s (backs off to 5 min while failing)
        L->>L: next_batch - 32 msgs round-robin, max 5 with images
        L->>O: one HTTPS outcall for all texts, images per-message
        O-->>L: flagged categories per input
        L-)G: MessageClassified (batched event sync)
        G->>G: flag_message (empty result clears stale flags)
        alt SEXUAL_MINORS flagged
            G->>G: trigger CSAM escalation (see section 5)
        end
    end
```

- **Why a broker** — one OpenAI caller per subnet (~a dozen fleet-wide) instead of one per active
  chat (unbounded): org rate-limit consumption becomes predictable, HTTPS outcall usage aligns
  with the per-subnet slot budget, and the API key never leaves `user_index` and the local
  indexes.
- **Fairness and dedup** — batches are taken round-robin across source canisters so a single busy
  chat cannot starve the subnet; queued messages are keyed by message id so an edit replaces the
  queued content instead of classifying the message twice.
- **Outcalls** — `is_replicated: Some(false)`: one request from a single replica instead of ~13,
  no consensus or transform needed. Acceptable because a bad result either hides a message in the
  app-store build or triggers a CSAM sanction that always alerts a human and is reversible. Cycles
  are charged at the replicated rate and the excess refunded.
- **Text vs images** — texts for a whole batch (from many chats) go in one call; each
  image-bearing message is classified separately (text and images in separate calls). The message
  result is the union of category bits; if *any* part fails (e.g. an unreachable blob URL), the
  whole message is treated as failed and retried, so a transient image error can't silently skip
  image classification. A text batch whose response has fewer results than inputs is also treated
  as failed and retried.
- **Resilience** — queue capped at 2k per source / 20k total (drop-oldest, logged), with queued
  text truncated to 4000 chars at enqueue to bound memory; 3 attempts per message; the job is
  non-reentrant (one batch in flight at a time) and its interval backs off exponentially (10s →
  5 min) while every call in a batch fails, resetting on the first success. Requests and results
  ride the existing idempotent event sync queues, which retry until delivered.

## 4. Report flow (#9092) — user reports reuse the pipeline's judgement

The mechanics first — who calls whom when a user reports a message. Reports on group and channel
messages route via `group_index`; direct-chat reports go straight from the reporter's user
canister to `user_index` (private content is classified but never flagged, and never deleted —
the reporter can delete it themselves).

```mermaid
sequenceDiagram
    participant R as Reporter
    participant G as Owning group / community
    participant GI as group_index
    participant UI as user_index
    participant O as OpenAI /v1/moderations
    participant MC as Moderation channel
    R->>G: report_message
    G->>GI: c2c_report_message
    GI->>UI: c2c_report_message (content + any pipeline flags)
    Note over UI: dedup + reporter rate limit,<br/>report recorded against sender
    alt already classified by the pipeline
        UI->>UI: reuse stored flags
    else not yet classified
        UI->>O: classify content (async)
        O-->>UI: flagged categories
    end
    UI-)G: c2c_flag_message (public chats, when flagged)
    alt CSAM
        UI-)G: delete message
        UI->>UI: suspend sender indefinitely (timer job)
        UI-)MC: post ModerationReport alert (auto-sanctioned)
    else clean, or human-review categories
        UI-)MC: post ModerationReport for review
    else adult only
        Note over UI: flag only - no sanction, no escalation
    end
    UI-)R: OC bot message with the outcome<br/>(sender also notified on CSAM)
```

And the decision routing in full:

```mermaid
flowchart TD
    R[User reports message] --> UC[user canister or group_index]
    UC --> UI[user_index c2c_report_message]
    UI --> DD{Already reported?}
    DD -- by this user --> X1[AlreadyReported]
    DD -- outcome exists --> X2[Bot message to reporter with outcome]
    DD -- new message --> RL{Reporter over<br/>10 new reports / hr?}
    RL -- yes --> X3[Dropped, warn logged]
    RL -- no --> CL{Message already has<br/>pipeline flags?}
    CL -- yes --> HR
    CL -- no --> API[Classify via OpenAI] --> HR{Route on categories}
    HR -- SEXUAL_MINORS --> AS[Auto-sanction: delete message,<br/>suspend sender indefinitely,<br/>alert to moderation channel]
    HR -- none, or human-review categories --> ESC[Escalate to internal<br/>moderation channel]
    HR -- adult only --> FO[Flag only - hidden in app store]
    AS --> N[Bot messages: sender told of violation,<br/>every reporter told the outcome]
    ESC --> N
    FO --> N
```

- **One classification per message** — reports are deduplicated on (chat, thread, message index);
  later reporters attach to the existing report and get notified when the outcome lands. A report
  arriving after a human verdict already landed gets the verdict wording, not "referred for
  review".
- **Classification is durable** — every new report writes a persisted pending-classification
  entry (removed when the outcome is recorded). Failures retry on a timer with exponential
  backoff (up to 5 attempts) and post_upgrade re-enqueues pending entries, so an upgrade or
  outcall failure mid-classification can't strand a report. If retries exhaust, the outcome is
  recorded with a distinct classification-failed marker and still escalates to human review.
- **Unflagged reports still escalate** — the API can't judge scam/spam, so a clean classification
  goes to human review rather than being dismissed.
- **Rate limit** — 10 not-yet-reported messages per reporter per hour. Excess reports are dropped
  silently (warn in logs); only the flooder's own reports are affected and the messages stay
  reportable by anyone else. Protects against mass-report cost amplification.
- **Modclub is gone** — guards, canister ids, state and the subscription flow are removed; legacy
  Modclub outcomes still deserialize via an untagged `ReportOutcome` enum (covered by a serde
  test).

## 5. CSAM escalation (#9093) — pipeline detections route to the same sanction

When the *pipeline* (not a report) flags `SEXUAL_MINORS`, the owning canister fires
`c2c_csam_detected` → `group_index` (which verifies the caller and derives the chat id) →
`user_index`, which runs the same auto-sanction as the report path: delete the message, suspend
the sender, and post an alert into the moderation channel. The shared logic lives in
`backend/canisters/user_index/impl/src/model/moderation.rs` so the two paths can't drift.

- Message excerpts are truncated to 500 chars, Unicode-safe, before leaving the canister.
- Both hops are fire-and-forget with retries (up to 50 attempts, exponential backoff):
  group_index verifies the caller synchronously, then forwards to user_index via its own
  fire-and-forget handler — so a stopped or upgrading user_index delays delivery instead of
  dropping it.
- The alert is posted for the legal record even if the sanction itself fails.

## 6. Human verdicts (#9095) — the moderation channel is an inbox with buttons

Escalations arrive in the internal moderation channel (configured via
`set_internal_moderation_channel`) as a structured `ModerationReport` message type — message
link, sender, reporters, flagged categories, excerpt, status — instead of plain text. Platform
moderators resolve them in place.

```mermaid
sequenceDiagram
    participant M as Platform moderator
    participant C as Moderation channel (community canister)
    participant UI as user_index
    participant G as Owning group / community
    M->>C: ModerationReport rendered with verdict buttons
    M->>UI: resolve_moderation_report(verdict)
    alt Uphold
        UI->>G: delete message
        UI->>UI: suspend sender - 1 day, indefinite after >2 breaches
    else Uphold as CSAM
        UI->>G: delete message
        UI->>UI: suspend sender indefinitely
    else Dismiss
        UI->>UI: record outcome, no action
    end
    UI->>C: update the report message status
    UI->>UI: bot messages to sender / reporters
```

- Verdicts are gated to platform moderators at both `inspect_message` and the endpoint guard;
  double-resolution is blocked.
- Suspension tiers come from the sender's in-breach report count: ≤2 upheld breaches → 1-day
  suspension, more → indefinite.
- The verdict UI exists in both component trees (`components/` and `components_mobile/`);
  "Uphold as CSAM" uses the danger variant on both. Buttons stay disabled after a successful
  verdict until the status update syncs back, and the flagged-category names come from a single
  table in openchat-shared (mirroring the Rust bitfield) rather than per-component copies.
- Reports on direct-chat messages show "link unavailable (private chat)" instead of a message
  link — direct-chat routes resolve relative to the viewer, so a link into someone else's private
  chat would be dead for moderators. The excerpt and flagged categories are still shown.

> **Recently fixed — suspension visibility.** Suspending a user never bumped their
> `date_updated`, and the `users_suspended_since` fallback in the `users` query excluded any user
> the caller was already tracking — so clients never saw the suspended flag and cached the stale
> record forever (only an IndexedDB wipe recovered). Fixed in #9092 by bumping `date_updated` on
> suspend/unsuspend; the flag now arrives on the next users poll.

## 7. App-store gating (#9094) — what the store builds hide

`OC_APP_STORE === "true"` is a compile-time flag on the Tauri mobile builds — the gating code is
baked in at build time, so there is nothing for a client to toggle. The web app is unaffected.

| Content | Hidden when | How it shows |
|---------|-------------|--------------|
| Community | `Adult \| Offensive` flag set | Filtered from explore/search (backend + client), navigation blocked, membership placeholder |
| Group | `Adult \| Offensive` flag set | Same as communities; channels inherit their parent community's restriction (including channel deep links, which check the parent community's flags before previewing) |
| Message | any `ModerationCategories` bit set | Rendered as an inert restricted placeholder, like a deleted message; chat-list previews and quoted reply excerpts show the restricted placeholder too |

Member-facing group summaries (`GroupCanisterGroupChatSummary` + updates) carry
`moderation_flags` just like the community equivalents, so gating applies to groups the user is
already a member of, not only previews and explore results. Search/explore filtering strips only
the Adult/Offensive bits — a user's UnderReview preference is preserved, since UnderReview must
never hide anything.

Known, deliberate limits: search results and notifications are not yet gated (called out in the
PR).

## 8. Operations — deploying and running it

- **Upgrade order** — the pipeline adds two event variants: `MessageClassifyRequest`
  (group/community → local_user_index) and `MessageClassified` (local_user_index →
  group/community). A not-yet-upgraded receiver traps decoding an unknown variant; the batched
  event sync then retries every 5 minutes and heals itself once the receiver is upgraded, so
  ordering is a smoothness concern, not a correctness one. Upgrading local indexes before
  groups/communities minimises the retry window.
- **API key** — `set_openai_api_key` on `user_index` (ingress allowed in `inspect_message`); it
  syncs to the local indexes only — group and community canisters never hold it. No key ⇒ the
  broker queue stays parked and report classification retries with backoff, then records a
  classification-failed outcome (which still escalates to human review).
- **Frontend cache** — the chats IndexedDB cache version bumps to 149 (#9088) and 150 (#9094);
  both clear the chats store so summaries refetch with the new flag fields. Migrations are keyed
  by the version being upgraded *from*: bumping to N registers `.withMigration(N-1, …)`. If
  another PR bumps the version, take the next free number — two PRs claiming the same version
  means the second deploy's migration never runs.
- **Costs and rate limits** — one OpenAI call per subnet per tick for all queued texts (≤32
  messages across all chats) plus one per image-bearing message (≤5 per tick); report-path calls
  only for messages the pipeline hasn't already classified. With ~a dozen local indexes the
  fleet's worst-case OpenAI request rate is ~13 × 6/min for texts — comfortably inside org rate
  limits and predictable. Single-replica outcalls keep cycle costs at 1/13th of a replicated
  call.
- **Observability** — dropped queue entries, rate-limited reporters, unknown OpenAI categories and
  missing users at suspension time are all logged with `warn`/`error`; each local index exposes
  its broker queue length in metrics (`message_moderation_queue_len`), and reporting metrics
  expose message counts and pending outcomes.

**Still open**: PocketIC coverage exists for the pipeline CSAM auto-sanction, the
report→UpheldAsCsam path (including double-resolution rejection and suspended-flag visibility)
and multi-reporter dedup, but not yet for the Uphold 1-day vs >2-breach boundary, Dismissed
(flag clearing), the reporter rate limiter, or a non-moderator calling
`resolve_moderation_report`. Notification and search-excerpt gating remain future work.
