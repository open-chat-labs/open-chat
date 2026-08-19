# Moderation state machine — invariants

Status: NORMATIVE as of branch `block-pinned-reshares` (2026-08-18). This document is the
specification the test suite asserts and reviews check against. Every invariant is anchored
to its enforcement point in code. If the code and this document disagree, one of them has a
bug — finding out which is the point of writing this down.

Method note: this exists because this subsystem's invariants were implicit, and every review
round found violations of rules that lived only in old commit messages. New invariants must
be added here in the same PR that introduces them.

## 1. Where state lives

| State | Canister | Structure |
|---|---|---|
| Reports (all kinds) | user_index | `ReportedMessages.messages` (append-only, report index = position) |
| Message-key dedup | user_index | `ReportedMessages.lookup` keyed `(chat, thread, message_index)` — BlockedAttempt reports are NOT in it |
| Per-user report list | user_index | `user.reported_messages` (drives strike counts + sanction checks) |
| Suspension | user_index | `user.suspension_details` (timestamp, duration, reason) |
| Hash-match sanction record | user_index | `user.csam_upload_sanction { csam_report_index, contested }` |
| Authority (NCA) register | user_index | `AuthorityReports { due, filed }` keyed by report index |
| Quarantine claims | storage_bucket | `Vault.records[hash].report_indexes` (+ `verdicted_report_indexes`, `legal_hold`, `release_pending`) |
| Serving pin | storage_bucket | `Files.vault_pins` (hash set) — gates `http_request` AND uploads |
| Denylist | storage_bucket (+ index copy) | `Vault.csam_hashes: hash → report_index` |
| Blocked-attempt dedup | storage_bucket | `Vault.blocked_attempts: (uploader, file_id)` |
| Message deletion + flags | group/community | chat events (`moderation_flags` word, deleted state) |
| Scan job log | local_user_index | `MediaScanJobLog` (monotonic, NOT dense — see I20) |

## 2. Report kinds and lifecycle

`DetectionSource`: `UserReport` (user-filed), `Proactive` (classifier or media hash match),
`BlockedAttempt { original_report_index }` (storage refused a re-post; no message exists —
the report borrows the ORIGINAL report's message coordinates as its evidence anchor).

Outcome lifecycle (one-way):

```
outcome: None ──automated──► Automated { action, sanctioned, human_verdict: None }
                                            │ resolve / mirror / inherit
                                            ▼
                              Automated { …, human_verdict: Some(Upheld | UpheldAsCsam | Dismissed) }   (terminal)
```

`ModerationAction`: `FlaggedOnly` (no alert, unresolvable until escalated),
`EscalatedForHumanReview` (no sanction yet), `AutoSanctioned` (sanction at detection).

## 3. Invariants

### Suspension

- **I1a — Reversal lifts only automated suspensions.** Every automated unsuspend path checks
  `suspension_is_automated` (suspended_by == OpenChat Bot): `has_other_active_sanction`
  cannot see manual moderator suspensions, so without this a dismissal could lift one.
- **I1 — Attribution.** Every suspension is attributable to at least one holder: an
  unresolved sanctioned report (`suspension_applied_without_verdict`), an upheld verdict
  (indefinite for UpheldAsCsam, one day for Upheld — `keeps_sender_sanctioned`), a hash-match
  sanction record, or a manual moderator action.
- **I2 — Own-contribution reversal.** A report's resolution may lift only that report's own
  contribution. Enforced by `has_other_active_sanction(sender, except_report_index)` before
  every dismissal-driven unsuspend. A dismissal must never lift a suspension another report
  or record still justifies.
- **I3 — Hash-match record discipline.** `csam_upload_sanction` short-circuits BOTH
  `has_other_active_sanction` and `has_other_indefinite_sanction` (deliberately: it has no
  report in `user.reported_messages`... historically — see I10). Therefore it MUST be cleared
  at exactly three points, or the user is unsuspendable forever:
  1. `unsuspend_user` (manual/human decision — clears unconditionally);
  2. `clear_csam_upload_sanction_if_for_report` when the report it points at resolves
     (mirror arms of `resolve_moderation_report`, state-derived arms of
     `c2c_csam_upload_detected`) — and this clearing must happen BEFORE the
     other-sanction helpers are consulted, or they self-defeat;
  3. never anywhere else.

  The clear is never a PRECONDITION for the reversal decision: the record is a single slot,
  so a later attempt against a different report overwrites it, and an attempter whose every
  report is resolved must still unsuspend. The reversal decision rests on
  `has_other_active_sanction` alone, after the clear.
- **I4 — Expiry lifts only its own suspension.** A scheduled durational unsuspend applies
  only if the suspension in force is the one it was scheduled for
  (`UnsuspendUser.expected_suspension_timestamp` guard).
- **I5 — Truthful notification.** The user is told a suspension was lifted only after the
  unsuspension actually landed (the `UnsuspendUser` job owns the notification; failure and
  not-suspended paths must not claim an unsuspension). Generally: every user-facing message
  states only what has actually happened (see I21).

### Reports

- **I6 — Report identity.** At most one report per message key `(chat, thread,
  message_index)`; concurrent detections collapse into it (`add_proactive_detection` returns
  the existing outcome, sanctions do not re-apply — one report, one sanction). BlockedAttempt
  reports are keyed per `(original_report, attempter)` instead: a fresh report per attempt,
  EXCEPT attempts within `ATTEMPT_RETRY_WINDOW` of the latest attempt REPORT's creation
  (client retries are one human act; the window is FIXED, not sliding - a sliding window
  would let an offender attempting every few minutes mint one offence record forever) or beyond
  `MAX_ATTEMPT_REPORTS_PER_OFFENDER` (a suspended user must not mint unbounded register
  rows), which tally onto the offender's latest attempt report (`repeat_attempts` capped at
  `MAX_RECORDED_REPEAT_ATTEMPTS` + overflow counter — the COUNT is never lost, see I14).
- **I7 — Single, independent resolution.** A report resolves exactly once
  (`record_human_verdict` → `AlreadyResolved`). A moderator may not resolve a report they
  are party to (own message: all verdicts barred; own CSAM assertion: only UpheldAsCsam
  permitted). `FlaggedOnly` outcomes cannot receive a verdict until escalated.
- **I8b — Attempt indexes are rejected by every evidence-affecting entry point.** An attempt
  report aliases the ORIGINAL report's blob references while carrying the attempter's
  `sender` and its own (virgin) `release_pending`, so any guard evaluated against the
  targeted report reads the wrong values. `set_vault_legal_hold` and evidence destruction
  (propose-time validation AND execute) reject BlockedAttempt indexes outright - most
  critically, the dual-authorization gate on release-performing hold clears reads
  `release_pending` and would otherwise be bypassable with a single operator.
  `record_authority_report_filed` accepts them (attempt rows are real register rows) but its
  conflict guard covers BOTH subjects: the attempter and the original report's sender.
  Filing an attempt row re-anchors retention through the original's aliased blob references -
  deliberate: the attempt is its own offence, and the retention clock only ever extends
  (`apply_verdict` takes the max), never shortens.
  The consumer classes audited for attempt-report reachability are now three: consumers of
  `user.reported_messages`, consumers of report-index arguments, and the resolve/contest
  surfaces. Any NEW entry point taking a report index must decide its BlockedAttempt
  behavior explicitly.
- **I8a — Attempt reports are never contestable as reports, but attempters always have an
  Article 22 channel.** `mark_contested` refuses BlockedAttempt reports: a Contested attempt
  card would be unactionable (I8) and would short-circuit the contest loop before the
  hash-match sanction contest - the attempter's primary Article 22 channel, which posts the
  moderator notice. A standing contest on the sanction record survives a repeat attempt
  re-recording it (same report index). LAST RESORT: the record is a single slot and can be
  cleared or overwritten while unresolved attempt reports still hold the user suspended -
  the contest then lands on the newest such report (contested recorded WITHOUT flipping the
  card) and raises the notice, so no suspended attempter is ever without a review channel.
- **I8 — Attempt reports are never directly resolvable.** `resolve_moderation_report`
  rejects `DetectionSource::BlockedAttempt`. Pre-verdict attempts resolve ONLY by mirroring
  their original's verdict (`mirror_verdict_to_attempt_reports`, which skips
  already-resolved entries); post-verdict attempts are born resolved, inheriting the
  original's verdict. Corollary: the message-restoration side effects (undelete, flag clear,
  hard delete) must NEVER execute against an attempt report — its message coordinates
  belong to the original.
- **I9 — State-derived side effects.** The consequences of a blocked attempt (authority
  entry, card status, sanction handling, uploader wording) derive from the attempt report's
  actual state at processing time (`human_verdict()`), never from the transport's snapshot
  of the world (the bucket's match kind) — the c2c hop is async and the original can
  resolve in flight. This applies to EVERY arm which sanctions, tallied repeats included: a
  repeat against an attempt report whose mirror already resolved it must never resurrect
  the reversed sanction (the mirror runs once and would never clear it again).
- **I10 — Universal registration.** Every report, including BlockedAttempt, is registered on
  its sender via `push_reported_message`, so `has_other_active_sanction`,
  `has_other_indefinite_sanction` and contest see all of them. (I3's short-circuit is thus
  belt-and-braces for the record's own linked report, not the only visibility mechanism.)
  EXCEPT strikes: `in_breach` is always false for BlockedAttempt reports - several can
  describe attempts on one piece of content, and counting them would escalate an eventual
  non-CSAM Upheld to the repeat-offender permanent ban for an attempter whose content's
  sender gets a day.

### Vault and storage

- **I11 — Claim-based quarantine.** A blob is evidence for every report whose claim it
  holds (`records[hash].report_indexes`). Release (unpin) happens only when the last claim
  is released and no legal hold stands; a hold converts release to `release_pending`. One
  report's dismissal must never destroy another report's evidence.
- **I12 — Denylist arms only on verdict.** `csam_hashes` is populated exclusively by
  `apply_verdict` (UpheldAsCsam). Quarantine alone never denylists; dismissal never
  populates it; an armed entry is permanent (the verdict is terminal).
- **I13 — Pinned/denylisted content is inert, and only machine-backed pins sanction.** The
  bucket serves neither (`http_request` 404s both) and refuses new references to either:
  `upload_chunk_v2` and `forward_file` refuse denylisted hashes (reported against the
  denylist's report index) and vault-pinned hashes (reported against the OLDEST ACTIVE claim
  via `pinned_report_index` - the first quarantiner is the strongest claim, and a later
  frivolous assertion on the same blob must not dilute the anchor). A pin retained only by a
  legal hold has no active claim: the upload is still refused (no dead references) but
  nobody is sanctioned or reported against a resolved case. Pre-verdict attempt SANCTIONS
  additionally require the anchor report to be machine-BACKED, judged by
  `machine_sanction_applied()` - the automated outcome's `sanctioned` flag ALONE, which is
  recorded once at detection and never cleared, i.e. true provenance. Neither
  `DetectionSource` (overwritten when a machine detection collapses into a user report) nor
  verdict presence (flips when the anchor resolves while the attempt event is in flight -
  I9) may enter the predicate: provenance is an immutable fact about the pin's origin and
  must be read from a recorded fact, never reconstructed from mutable state. A pin whose anchor carries no machine-applied sanction came from
  an unverified reporter assertion, which deliberately does not suspend the reported sender
  and so must not suspend third parties either - those attempts are blocked and surfaced as
  a throttled notice only. The anchor is the FIRST-ARRIVED claim (`claim_order`, explicit,
  because report indexes are creation order not claim order).
- **I14 — No silent attempts.** Every blocked attempt leaves a moderator-visible trace: a
  report card (new attempt report), a repeat notice naming the offender (tallied attempt),
  or a plain notice (unresolvable uploader / unknown original report / reporter-asserted
  pin). Every attempt is COUNTED even when not individually recorded. The bucket's
  per-`(uploader, file id)` sighting dedup is cleared when a hash changes adjudication
  state (denylisted, or released) so that a pre-verdict sighting can never suppress the
  reporting of a post-verdict attempt on the same stable file id (forwards) - INCLUDING
  dedup-shared file ids the vault never tracked, resolved against the Files model at every
  hash transition (`clear_sightings_sharing_hash`). ONE exception to the trace rule: a pin
  retained only by a legal hold has no active claim and its refusals are visible only in the
  bucket log - a hold is a rare, operator-created state and no report can honestly anchor
  the attempt. Notices are throttled per (report, OFFENDER): one offender's flood must not
  consume another offender's only named trace. The sighting
  set is BOUNDED (oldest evicted; a re-report is tolerated per I18), and notices are
  throttled per anchor report with a suppressed-attempt tally - unsanctioned attempts are
  free to generate, so neither the channel nor a bot-DM stream may scale with them (the
  repeat arm sends no per-attempt DM at all: the first attempt informed the uploader and
  their sanction state has not changed).
- **I15 — Hash checks are spoof-proof.** Refusing on the DECLARED hash at upload is sound
  because an upload only completes if the bytes hash to the declared value
  (`PutChunkResult::HashMismatch` rejects the file).

### Escalation and the authority register

- **I16 — Register discipline.** An authority entry becomes due exactly once per report
  (`push_due` is idempotent against both `due` and `filed`), for exactly these events:
  an UpheldAsCsam verdict on any report (originals AND mirrored attempt reports), a
  born-resolved attempt report on already-adjudicated content, and the honest-unverified
  urgency-valve filing. Filing replaces the due row (`record_filed`, idempotent per report).
- **I17 — Flag-word discipline.** `moderation_flags` writes merge rather than overwrite
  where two detectors race: the media-scan arm ORs into existing classifier bits, and a
  scan-set SEXUAL_MINORS bit is sticky against a clean text classification of the same
  message. Only moderation-report resolution reverses a scan-set flag.
- **I18 — Escalation is idempotent and collapse-safe.** Re-delivered verdicts, duplicate
  detections and classifier/scanner races on one message produce one report and one
  sanction (I6); re-applied quarantines are no-ops; verdict re-send with quarantine
  (`quarantine_blobs_and_apply_verdict` on resolve) tolerates a lost detection-time op.

### Async delivery

- **I19a — Wire enums are append-only.** rmp-serde encodes unit variants by index: inserting
  a variant mid-enum renumbers everything after it, and an old receiver then silently decodes
  a NEW variant as a different existing one rather than failing. New variants go at the end,
  where an old receiver fails to decode and the fire-and-forget drops - the failure mode the
  deploy-order rules are designed around.
- **I19 — Every cross-canister edge is at-least-once or fail-visible.** Retried edges ride
  idempotency-checked event queues. Fire-and-forget edges (`c2c_csam_detected`,
  quarantine/vault ops, alert cards) drop permanently on decode/method errors — the system
  tolerates this only where a later step re-sends the effect (see I18) or where the loss is
  logged loudly (`CSAM upload match dropped: user_index canister id not yet known`).
  Deploy-order rules exist because of this: receiver-first for new enum variants.
- **I20 — Scan pipeline safety.** Media-scan job indexes are monotonic but NOT dense
  (per-source eviction): lookups are by search, never offset arithmetic. Verdict acks are
  clamped to the highest submitted verdict index; verdicts route only to jobs whose
  `message_id` echoes; nothing is ever implicitly marked clean on failure; the stalled
  pipeline self-detects (queue non-empty + front older than threshold + no verdicts) and
  alerts the moderation channel, which must be configured before scanning can be enabled.

### Wording

- **I21 — No overstatement.** User- and moderator-facing text distinguishes suspected
  (pre-verdict: "quarantined pending review", reversal promised — a promise I3 must keep)
  from confirmed ("upheld as CSAM"); never claims an action that did not happen (I5); and
  the contest notice tracks the linked report's actual state.

## 4. Known accepted weaknesses (documented, not defended)

- Suspension does not gate the storage upload path (`caller_is_known_user`): a suspended
  user can still generate blocked-attempt events. Bounded by I6's caps; fixing requires
  syncing suspension into storage_index.
- Message `thumbnail_data` is client-supplied, unscanned and uncapped — a crafted client
  can inline images outside the scan pipeline entirely. Accepted for now (2026-08-18).
- storage_index forgets its learned `user_index_canister_id` on upgrade: attempt-match
  relay drops (loudly) until any vault op re-teaches it. Operational runbook step.
- An edit inside the scan window is re-scanned as new content; the original content's match
  still escalates (matched blob refs travel on `MediaScanMatched`), but a message deleted
  before the verdict lands drops the verdict entirely (lookup miss).
- Attempt reports borrow the original's message coordinates; safety depends entirely on I8.
- Attempts during the pending window of a reporter-asserted quarantine that is LATER upheld
  are not retro-reported as offences (only blocked + noticed at the time): the attempters
  were not provably knowing, and the denylist covers everything after the verdict.
- Blocked-attempt report cards carry `is_blocked_attempt` so the client hides verdict
  actions (I8); pre-upgrade clients show the buttons and receive the canister's rejection.

## 4a. New-state checklist (seeding and bounds)

Every field this feature added, audited for upgrade seeding and growth bounds - any NEW
field must be added here with its answer:

| Field | Seeded on upgrade | Bounded |
|---|---|---|
| `VaultRecord.claim_order` | lazily at next claim (`seed_legacy_claim_order`) | by claims |
| `Vault.blocked_attempts(_order)` | rebuilt in post_upgrade | `MAX_BLOCKED_ATTEMPT_SIGHTINGS`, oldest evicted |
| `Vault.csam_hashes` | n/a | permanent BY DESIGN (verdicts are final) |
| `Data.blocked_attempt_notice_throttle` | n/a (default) | capped; inert entries dropped past `MAX_THROTTLE_ENTRIES` |
| `ReportedMessage.blocked_attempt_report_indexes` | n/a (default) | `MAX_ATTEMPT_REPORTS_PER_OFFENDER` per offender |
| `ReportedMessage.repeat_attempts` | n/a (default) | `MAX_RECORDED_REPEAT_ATTEMPTS` + overflow counter |
| `MediaScanJobLog.*` | n/a (default) | `TOTAL_CAP` / `PER_SOURCE_CAP`; scalars |
| `CsamUploadSanction.contested` | n/a | single slot; preserved across same-report re-records |

## 5. Test matrix (invariant → scenarios; drives the next step)

| Invariant | Scenarios to assert |
|---|---|
| I1/I2 | dismissal with/without second active sanction; expiry vs replacement suspension (I4) |
| I3 | attempter unsuspended on original's dismissal; downgraded on Upheld; record survives UpheldAsCsam; unrelated dismissal lifts nothing |
| I6 | classifier+scanner same message = one report; attempt in window = tally; attempt past cap = tally; distinct attempts = distinct reports + register rows |
| I7/I8 | double-resolve rejected; self-resolve rejected; attempt-report resolve rejected; mirror skips resolved |
| I9 | resolve-before-event race: born-resolved attempt gets register entry + correct card |
| I11/I12/I13 | two claims, one dismissal → blob retained; dismissal → no denylist, re-upload allowed; uphold → denylist, re-upload blocked + new report; hold-only pin → refused, no sanction |
| I14 | every attempt variant produces card/notice; counts survive caps |
| I16 | one due row per report; mirrored attempts add rows; filing clears due idempotently |
| I17 | scan flag survives clean classification; classifier bits survive scan flag |
| I19/I20 | verdict redelivery no-ops; ack clamp; stall alert fires + all-clear |
| I21 | uploader/contest/restoration texts per state |
| I13 (provenance) | reporter-asserted pin: third-party re-upload blocked WITHOUT sanction or report |
| I9 (repeats) | repeat after linked resolution never resurrects the sanction |
| I1/I2 (record overwrite) | attempts against two pending reports; both dismissals in either order fully unsuspend |
| I14/I16 (forward dedupe) | pre-verdict blocked forward, uphold, post-verdict forward still reported + registered |
| I13 (machine-backed predicate) | machine detection collapsed into a user report still sanctions attempts |
| I13 (claim order) | assertion claim on an older report never displaces a machine anchor |
| I14 (throttle) | repeated unsanctioned attempts produce one notice, not one per attempt |
| I10 (strikes) | attempt reports never escalate an Upheld downgrade to indefinite |
| I8a (contest) | attempter's contest falls through to the sanction path and posts the notice; attempt card never Contested; contest survives a repeat re-record |
| I14/I16 (shared ids) | a dedup-shared file id blocked pre-verdict is still reported when forwarded post-verdict |
| I8b (vault ops) | legal-hold and destruction entry points reject attempt report indexes |
| I14 (per-offender throttle) | two offenders against one pin each get a named notice |
| I8a (last resort) | attempter with cleared/overwritten record can still contest; notice posted |
| I6 (fixed window) | attempts spaced inside a sliding-but-not-fixed window mint new reports |
| I1a | dismissal never lifts a manual moderator suspension |
