# Draft update: generic in-chat cards and external-app processing

Target: existing [fork PR #73](https://github.com/ktimam/open-chat/pull/73), stacked on the
refreshed model PR. Keep draft status; retarget upstream only after the stack is agreed.
This is a prepared description, not a PR update or publication action.

## Exact-head hosted checkpoint — September 15

At published head `2b17aa16e973c573f1ac28476639aa7c2417df36`,
[full frontend CI](https://github.com/ktimam/open-chat/actions/runs/34980944567)
passes 3,116 tests and production WebGPU distribution verification. Model frontend,
Android, real-inference and both native-platform jobs pass. Backend tests, formatting,
lint and Candid checks also pass. The completed app/model integration job passed
54 tests with zero failures, one deliberate capacity-stress ignore and 411 filtered out.
The separate scoped npm collector compatibility fix passes offline tests locally;
the published workflow remains red. The scoped Sharp patch and optional Node GPU
download setting are local follow-ups, not new hosted acceptance. The remaining
adm-zip advisory is open and user-deferred for this handoff; inherited Rust findings also remain deferred. No whole-core
audit, advisory suppression, active app-prompt change or new APK is implied.
See the [hosted follow-up](model-app-readiness.md#exact-head-hosted-follow-up--september-15).

Historical CI-repair status: the initial reconciled stack was published at
`156b7bfbed79d692b34d5db693ec1d86546e04fd`; both PRs remain drafts. The follow-up
fixes the shared model CI defects, Android bundletool runner-context validation,
and the standalone PocketIC fixture identity. Fixture downloads pass verification,
but the hosted Linux integration tests must still run beyond that gate. Local
Node 24.18.1 frontend/agent type checks pass; the complete frontend suite passes
3,116/3,116 across 209 files with no skips, and full lint has zero errors (31 warnings).
The checked-in offline helper selection passes 1,016/1,016 without skips; scoped
formatting passes for 339 files. Exact-head hosted acceptance and the
separate app-owned receipt-note accuracy/delivery gates remain outstanding.
See the [current CI-repair record](model-app-readiness.md#ci-repair-follow-up--september-15).

Historical pre-publication checkpoint (September 15): the scoped local frontend selection passes
1,892/1,892 tests across 91 files; offline model/app CI and packaging helpers pass 915/915.
Successful runs have no skipped tests. The current combined cleanup APK passed three fresh
smaller-Qwen image/card proposals, including a repeated image without restarting. All three
completed GPU cleanup; cards were left unsaved. Exact-head hosted CI/review remains pending,
and these local Node 24.14.1 results are not the hosted Node 24.18.1 runtime. Existing inherited
advisories remain documented/deferred, not suppressed. See the
[historical scoped check record](model-app-readiness.md#historical-scoped-pr-checks--september-15).
The dated narrative below is retained as history and does not override that checkpoint.

Historical local status (September 14): the catalog-enabled combined APK has opened verified
app-authored cards for two fresh Gemma image cases, three consecutive Qwen image proposals,
and a post-switch Gemma repeat using the retained model cache.
Source values, dates/ranges, private saved-Type selection and configured direction were
inspected in the actual card frames. A partner-backend deserialization mismatch was fixed
in that app, without weakening host attestation or moving domain logic into OpenChat.
These checks do not establish current authenticated delivery, broad image accuracy, optional
audio inference or final-stack hosted acceptance. Feature-scoped Rust CI migration and
bounded source review are complete; inherited advisories are documented and deferred at
the user's request, not counted as a clean security gate. The earlier 111-inference
shared-prompt investigation is historical; the app now
supplies separately configured prompts for the selected models. All domain prompts,
expectations and recorded regression fixtures remain in the app repository. See the
[current acceptance record](model-app-readiness.md#current-configurable-webgpu-model-catalog).

## Summary

Provide reusable registered app interfaces for chat: bounded manifests and app enablement,
scoped linking, isolated app-authored cards, private context, exact content attestation,
user-reviewed confirmation and authenticated delivery.

The newer integration checkpoint adds a generic app-owned local processor. An app declares
the protocol in its registered schema and receives bounded text/OCR evidence for extraction,
or model candidates for normalization. The host supplies inference and validation plumbing;
the app owns interpretation, labels, field meanings and final backend constraints.

The generic host also accepts an additive, bounded app-authored image-template map keyed by
the selected opaque model ID. It preserves the exact v1 fallback, text/private-reader paths,
app-declared focused passes and all post-extraction checks. It introduces no model-family or
partner-specific prompt logic and does not activate any partner's unqualified prompt.
The new selection suite and existing action contracts pass 271 tests; targeted TypeScript
checks and ESLint pass. These are host-interface checks, not image-accuracy or APK acceptance.

## Security and lifecycle

- Registered app surfaces only; opaque credentialless sandbox, exact source-window checks,
  independent frame/request nonces and bounded timeouts/concurrency.
- No account credentials, private-context grant or consumer keys in processing messages.
- Validate raw candidates and returned candidates before card construction.
- Preserve exact app-authored content verification, confirmation binding and versioned delivery.
- Reconnect/retry must retain prepared work without silently repeating model inference or
  treating an unverified card as accepted.
- Keep production/testnet capability brakes, backend authorization and snapshot restrictions.
- Keep app-specific code, prompts, fixtures and examples in their app repositories.

Protocol reference: [Local app processing](../local-app-processing.md).

## Verification and readiness

Latest status (September 9): local PR2 is `d7b94d8649951a5b7d4f46b7d216d41734dd4cf7`, with
PR1 `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b` included through a tree-preserving merge.
GitHub recheck on September 9: published PR #73 remains draft at `c7299aa11`, with
no reported checks; neither local head
has replaced its published PR head. The last full recorded offline helper aggregates passed
PR1 104/104 and PR2 340/340. The earlier September 8 CI-only 95/95 PR2 selection remains
historical focused evidence. Both unfiltered frontend workflows initially contained the separate,
exact nine-test-file **Check offline feature inventory and CI contracts** step. Those helpers
plus model-CI coverage passed 262/262 tests on PR1 and 304/304 on PR2, entirely offline, including
four failing-first YAML-scalar regressions. The guard validates the actual single-line run,
all test omissions, commented/conditional/ignored execution, repository-root working directory
and inherited shell. This completes the bounded offline wiring check, not the whole workflow:
old whole-lockfile commands intentionally still fail closed, and hosted acceptance remains pending.

The step now selects eleven files. The later direct-feature ownership review records 40 model
files / 18 roots in each dirty PR working tree and 44 app/card/OCR files / 17 roots in PR2;
the matching snapshots are in `scripts/npm_feature_scope.pr1.json` and
`scripts/npm_feature_scope.pr2.json`. Ownership-helper tests passed 31/31 and 58/58,
and both CLIs exited 0 (terminal-reported, without a separate saved run receipt).
Fresh optional-audio/cache/composer unit selections pass 273 PR1 + 319 PR2 tests (592 total),
with 33/37 source inputs unchanged in `tmp/audio-cache-composer-20260909-g6cq4W/summary.json`.
These are overlapping source-level selections, not advisory, audio inference or phone acceptance.

All 25 canister WASMs and the complete integration executable now build successfully at that
PR2 head, with all 2,873 recorded inputs unchanged. The executable used
`cargo test --locked --offline -p integration_tests --no-run --message-format=json`.
Receipts: `wasm25-1da8bf10e18647f1b65cbddba22d46ac/summary.json` and
`tmp/pr2-integration-link-runs/launch-d668368c90a04bffb09f9f2a3031d412/summary.json`.
The following unfiltered execution selected 465 tests with one existing ignored test, but
PocketIC setup failed to bind a Linux AF_UNIX socket in Windows-backed temporary storage
(OS code 95, `Operation not supported`). Shared setup failures cascaded and the exact owned
driver was stopped. This is neither an integration pass nor a demonstrated product regression.
Receipt and stderr:
`tmp/pr2-full-integration-c779802401f245ee8adc83e92ab1dad6/logs/runtime-6e3af8fd69944a92b4f7e0d95a3cd1b2/summary.json`.
The user-approved RAM socket plan subsequently executed the selected 54-test gate. Its first
run returned 26 passed / 28 failed / one ignored, with 411 filtered. Stale test directory/card/
ingress assumptions were corrected in three integration-test files; production WASMs and security
assertions were preserved. A fresh source-bound harness-only relink and same-scope rerun produced
52 passed / 2 failed / one ignored, with 411 filtered. This retained red run exposed LF/CRLF
public-key text equality and a stale cancellation expectation for a pending confirmation lease.
Its source/input bindings passed and owned process/RAM cleanup completed. Receipt root:
`<project-temp-root>/tmp/pr2-selected-integration-45b05627a0274980aa41b75cf5ed562c`.
The final test-only correction uses canonical LF text and asserts the preserved lease, actor
restrictions, repaired-key retry and exactly-once encrypted delivery. A fresh harness-only
relink and same-scope run then passed **54 tests / 0 failures / one ignored**, with 411 filtered,
in **186.35 seconds**, exit 0. All 2,873 compiled-input identities stayed unchanged during
relink/execution; the only differences from the original producer are the three reviewed
integration-test files. Production/WASM inputs, fixture pins and lock identity remain unchanged.
Receipt: `<project-temp-root>/tmp/pr2-selected-integration-7380b7fc33de4badb35cd6cebe905f0f/summary.json`,
SHA-256 `56fc4d7f9c51a25c22fe1d9689bcdbc1a7e7b49a1ec993218ff2d11aa9e8a20e`.
Owned processes and the exact RAM child were removed. The subsequent disposable Windows
state cleanup preserved all 64 evidence/artifact hashes and recorded `windows-state-cleanup.json`.
This completes the selected local Windows-harness/Ubuntu-PocketIC functionality gate, not
hosted native-Linux CI acceptance; the existing ignored capacity stress test was not run.
The earlier socket and disk-preflight failures are historical, not the current execution state.
Final-stack hosted checks and authenticated phone app-card flows remain pending; the build,
link and selected local integration gates are no longer pending.
The completed backend compiler cache was subsequently retired during project-temp cleanup;
all 106 protected APK/native/harness/WASM artifacts and 2,889 retained runtime/unknown files
were unchanged. Generated Cargo fingerprints were invalidated so future builds regenerate
missing outputs. Do not treat the target as a warm compiler cache; the retained executable,
fixtures and source-bound pass receipts remain valid. See the cleanup receipts in
[current readiness](model-app-readiness.md#september-8-native-build-and-integration-evidence).
One user-triggered image proposal has now reached the verified editable app card on the
physical phone, with its expected values and user-defined classification checked. It was
not confirmed or delivered; repeated-run and complete-journey acceptance remain pending.
A second user-triggered receipt initially omitted an expected field. An app-only prompt and
normalization repair was then tested on both exact images twice in the packaged phone worker,
registered locally, and checked through two fresh user-triggered UI proposals. Those earlier
`c79e08cb…` captures verified date/type/note, enabled confirmation and absence of horizontal
overflow, but excluded direction and accepted a guessed currency code. They are not complete
proposal qualification.

The latest app prompt changes only currency extraction to copy the printed code or symbol
literally, preserving interpretation in the app under the user's approved existing symbol
policy. Prompt SHA-256 is `2ed2358df07dc8c42a25eb8c3b6b27f183202c384dc460335d7d476fde34bda1`.
Four real packaged-phone Gemma 4 E2B runs at 96 tokens now preserve both images' expected
values and literal currency: portrait 33,396 / 32,757 ms; interval 34,205 / 33,034 ms.
Separately, the app fixes saved-type direction hydration while preserving manual edits and
readonly state, without category-specific keywords or OpenChat app logic. The latest complete
app-side unit run passes 1,738/1,738 tests; the preceding 1,654/1,654 full run
and 922/922 focused selection remain historical coverage. Both TypeScript checks and all 17 actual-host
recorded-output replays pass. These source/worker checks are separate from fresh UI evidence.
The app's production-mode candidate frontend also built successfully in the isolated external
directory documented in the app repository; it predates the later app normalization correction.
No deployment or APK update was performed by that build.

The updated definition is now published locally as revision `1788864441555`, replacing
`1788862105373` and its old `c79e08cb…` prompt. Anonymous verification matched the complete
regenerated response schema and exact backend manifest commitment. Existing registrar/admin
identities were reused, with no owner change, account reset or production deployment. Loopback
HTTP 200 checks verified the served direction assignment and labels. The PowerShell Tailscale
HTTPS check failed TLS authentication, without a certificate bypass; it does not establish
phone/Tailscale UI acceptance.

At `2026-09-08T10:54:29.928Z`, the user's fresh physical-APK proposal passed rendered-card
inspection with the expected amount, currency, kind, date, complete interval note, saved type,
and now its correct saved direction/display label. The receipt records one verified editable
frame, one enabled confirmation control, and 338 px viewport/document/body widths. App-owned
evidence: `output/playwright/phone-release-20260908/literal-currency-range-direction-proposal.json`.
The card revision was not captured; the separate source/manifest check for `1788864441555`
must not be presented as a captured-card revision assertion.

The inspector did not confirm the card or read backend delivery. The user subsequently reported
that the app's add/confirmation action appeared correct: delivery is **user-confirmed**, not
independently backend-verified. The original receipt retains `confirmationClicked:false` and
`deliveryVerified:false`; no reconnect journey was independently observed.

The phone temporarily disconnected and the earlier read-only Qwen/cache/audio preflight could
not attach. No forward/reset, selection, download, cache mutation or inference was attempted in
that preflight. Later cached base-model metadata matched and actual UI selection attached Qwen
without deleting the other downloaded model. One user-initiated all-WebGPU image completion ran
on the retained APK, but the app rejected an unsupported localized value. The app-only fix and
recorded-output replay live in the app repository, with no host semantics added. Live module
HTTP 200 checks alone are not a new phone proposal. USB later reconnected and a fresh multilingual
receipt card on the retained APK passed expected-content, enabled-confirmation and width checks
at `2026-09-08T12:21:00.404Z`, distinct from the retained older failing card. Receipt:
`output/playwright/phone-release-20260908/arabic-post-localized-date-proposal-card.json`.
This repeat did not capture confirmation/delivery, card revision, raw output or fresh model
identity, so it is not complete model/journey acceptance.

The subsequent user-triggered Qwen interval-image result on the same September 7 APK failed:
complete JSON arrived in 34,894 ms at 96 output tokens, but the amount lost a decimal digit,
the ending date was missing and app-owned kind/currency expectations were not met. The actual
card at `2026-09-08T12:41:33.990Z` had the wrong amount, empty date and incomplete note; enabled
confirmation did not make it accurate, and no confirmation was pressed. No GPU crash was
observed in the recorded completion. App-owned raw/schema/value evidence remains external in
`output/playwright/phone-release-20260908/qwen-range-proposal-trace.json` and
`qwen-range-proposal-card.json`. The 17-case actual-host/app replay passes its negative
contracts but explicitly fails model-image, strict-raw and full-card acceptance in
`qwen-range-current-prompt-failed-replay.json`; it is not a new model success. The failed output
is retained in the shared app-owned negative fixture. Subsequent date-first and transcription
prompt probes also failed image-content acceptance without observed GPU errors.

Generic cached-selection and incremental-hash responsiveness fixes now pass 106/106 focused
tests in PR1 and 111/111 in PR2, including failing-first preservation, starvation and cancellation
cases. Full-weight proof is reused separately from stale-worker refresh; cached SHA work uses
64 KiB updates with a macrotask yield after 8 ms or 4 MiB. These changes are now packaged in
`2.0.0-local-webgpu-responsive-20260908`: the 78,613,258-byte APK has SHA-256
`f830b5e79e0c33aa14bf1a415f181ab6694fe67fedc30d9ac2adde0bdb72d0b5`. All 5,958 source files,
four Git-link identities and 14 builder inputs stayed unchanged; 26 distribution assets and
independent signer/native-library/component checks passed. Receipt:
`<project-temp-root>/tmp/apk-responsive-source-identity-40ca20f0f3ea4318aa9661f3e43e4bd7/summary.json`.
This exact artifact was installed over the existing emulator app without clearing data. Its
first cold-start probe failed on an ADB attachment timeout before WebView/asset inspection.
A later, separate read-only inspection of the same process passed onboarding, exact local
version/origin, all 26 installed asset hashes, OTA-none and ORT/worker checks; it explicitly
does not accept cold startup. Both results and the screenshot are retained under
`<project-temp-root>/tmp/apk-welcome-smoke-152664d35de54d508bccecc74d1b19b5`.
The emulator was then gracefully stopped. No model download, inference, retained-account/cache
or physical-phone qualification was performed. This build changes runtime responsiveness,
not the current app prompt or Qwen image-accuracy failure. The last inspected physical phone
still had September 7's reviewed APK. Independently verified
confirmation/delivery, reconnect, repeated phone/model cache reuse, optional voice if enabled,
new-APK model/journey qualification and final-head hosted checks remain outstanding.
See the September 8 phone evidence in [current readiness](model-app-readiness.md).

The current handoff supersedes that September 8 artifact:
`OpenChat-local-test-qwen-20260909.apk`, version `2.0.0-local-webgpu-qwen-20260909`,
78,629,642 bytes, SHA-256
`5f2610f2fa27830e15c21b47b5b08b250b324f2989e032750fa3c0003efabe31`.
Its source-bound build matched the exact worker bytes used for the two-image desktop
checkpoint, not a broadly qualified image model. The subsequent emulator
cold-start passed (first ready 4,293.3406 ms), with all 26 installed assets, local origin
`http://tauri.localhost` and OTA-none policy verified. The owned emulator exited normally.
Exact receipts are in [September 9 APK evidence](model-app-readiness.md#current-qwen-local-test-apk-september-9).
No model/audio inference, account/model retention or physical-phone acceptance is claimed
by that smoke test. Publisher credentials or a distribution APK are not local-test prerequisites.

The pre-commit upstream-reconciled source passed 190 frontend files / 2,550 tests,
both typechecks and read-only lint on September 7.
The full backend unit workspace also passed 957 tests with one existing ignored test;
full strict backend Clippy now passes the locked/offline workspace with test targets and
warnings treated as errors, excluding only the two native-shell packages. This includes integration-test
compilation, not execution. The separate Candid parity result is recorded below; integration
execution remains unverified.
The earlier reconciliation was committed locally at PR2 `cdceb9d127a329b49a82795662fadba77ab2f18f`,
whose ancestry includes PR1 `b461c4b7a3b59daa1d1a4aace002e1d3ffa55d57`; it is not on this
PR's published head. The preceding frontend/backend results were recorded before these commits
and retain their documented source-snapshot boundaries. Both committed heads subsequently
passed their complete offline Node helper suites, 94/94 and 296/296, with clean, unchanged
before/after state; see the saved post-commit receipt in current readiness.

The follow-ups, validated before commit as changes atop PR2, restore missing shared ActionCard
declarations and the user-index private-match method/recipient scope to match existing Rust; runtime Rust is
unchanged. All 38 focused source contracts and 336 complete offline helpers pass, with
207 recorded inputs unchanged and formatting clean. This includes all 25 API method-name
sets and CI-routing regressions, not arbitrary signature/mode equivalence. Evidence:
`candid-contracts-all-apis-final-20260907-c8d69fd637234e51816036356c7a0852/summary.json`.
The full actual parity rerun after these repairs also passes: 25 generated interfaces / 50
strict bidirectional comparisons, with native exit 0 and all 2,879 recorded inputs and the
Cargo lock unchanged. Evidence: `backend-candid-parity-runs/launch-fce066b6cd434a5d81dd22583dec9c56/summary.json`
and its nested completion receipt. This covers the working declaration fixes atop the PR2
commit, not the commit alone. The reviewed local APK was subsequently built from clean
follow-up commit `e3d2cb91a426c67c6bcef0c5f664999e1676fb16`; emulator startup and all 26
installed runtime assets passed. See the exact-artifact record in
[current readiness](model-app-readiness.md#reviewed-local-test-apk-september-7).
No hosted, physical GPU or authenticated app-card acceptance is claimed by these checks.

Separate Windows native checks pass both shipping feature combinations and the 27/41
library-test selections. The explicitly selected real-text fixture test also passes on CPU;
it checks non-empty generation, not answer quality or phone WebGPU. The CI-count repair
passed 96 PR1 / 338 PR2 offline helpers while historical dependency-policy failures remained. See
[current readiness](model-app-readiness.md) for source boundaries and receipts.

Earlier full app-host boundary checks found no findings. Recorded-response
replay, real model inference and fully verified app-card flows remain distinct evidence.
A complete physical-phone partner-card run is still outstanding.

The prerequisite PR1 tree was independently rerun: all 123 frontend files / 1,488 tests and
94 offline helper tests pass without skips, both typechecks pass, and read-only lint has
0 errors / 30 warnings. Its 37 reviewed follow-up files plus nine lock/configuration inputs
retained their hashes and dirty status throughout the run. Evidence is recorded in
`pr1-frontend-validation-20260907-auth-display/summary.json`; see
[current readiness](model-app-readiness.md#september-7-verification-hardening) for the
separate Clippy receipt and remaining acceptance boundaries.

The current helper aggregate includes 48 real-shell action-inbox wiring tests. Structured
DFX JSON validation replaces prefix matching that falsely accepted app ID 12 when 1 was
expected and signing version 40 when 4 was expected. Hosted frontend policy now invokes
this suite explicitly, with coverage regressions. Shared native CI also executes pinned
component-contract tools and requires `--locked` on all six Cargo test/check commands.
These checks do not prove live canister wiring, consumer key trust or hosted acceptance.

The current frontend also separates anonymous-home welcome readiness from registry-backed
chat readiness in both UIs. Mounted regressions preserve authenticated/public-route gates,
landing-page precedence, Home-owned query actions, active form input and stopped-propagation
button events. Native error-display tests exercise the production template expression with
the real translation component and English/Arabic catalogs; handler routing is unchanged.
The September 6 APK below and the intermediate September 7 welcome APK predate the final
worker-logging and mobile-theme fixes. They are superseded by the reviewed September 7 APK
built from `e3d2cb91a426c67c6bcef0c5f664999e1676fb16`, with separate startup/asset acceptance.
It was the last inspected physical-phone artifact: the later diff to PR2 `d7b94d864` contains only
six documentation/security-policy/test paths, so no rebuild is required solely for that head
change. Subsequent source-bound September 8 and September 9 local-test APKs cannot be
attributed to that old build. September 9 startup/assets pass on the emulator; physical-phone
model/journey acceptance remains pending.
See [the current APK evidence](model-app-readiness.md#current-qwen-local-test-apk-september-9) and
[the reviewed APK evidence](model-app-readiness.md#reviewed-local-test-apk-september-7)
for its exact build attribution and limits; no physical-device inference or authenticated
app-card acceptance is implied by emulator startup/asset checks.

Earlier post-startup-fix production bundles also passed from the dirty merged working tree
combining `6be70333` and `2a95a68`, not either parent commit alone or this PR's published head.
Fourteen recorded source fingerprints remained unchanged during and across both builds.
Default production contains 933 files / 118,043,376 bytes; the explicit immutable-WebGPU
candidate contains 949 / 169,102,826. Fresh worker bytes match, all four generated ZIPs retain
their expected workers, and the candidate passes 26 exact asset checks (including 21 notices)
both in its directory and in both ZIPs. Recovery is now included in the main bundle rather
than loaded through a separate recovery chunk.

This is packaging evidence, not a refreshed APK or device/model/card acceptance result.
Default Rollup logged 581 TS6054 unsupported `.svelte` extension diagnostics; they did not recur
in the candidate after parallel typechecks ended, without an established causal explanation.
Other build warnings remain. No production feature gate was activated, fresh dependency audit
authorized, inventory uploaded or publisher artifact produced by these checks. The requested
local-test APK remains separate and does not require new publisher signing credentials or
publishing version/upload approval.

After those bundle checks, a fresh-checkout Android build-only defaults-loader fix added five
real-shell regressions: a missing optional `.env` is accepted, existing malformed/nonregular/
unreadable files fail, and outer values retain precedence. This raised the policy aggregate
from 193 to 198, without changing the 2,450-test frontend result. These helper checks do not
establish artifact or device acceptance.

### Historical September 6 artifact evidence

The earlier merged-source local APK was built and binary-verified: 78,596,874 bytes,
SHA-256 `c63fead2d577892bb4ff4e71da373c33f54cc39510d9e04eb9873e8a74f9ac56`, using
the dirty `6be70333` + `2a95a68` source. It preserves installed ID `com.oc.app`, code `1000`
and the existing local certificate while retaining code namespace `com.oclabs.openchat`.
Frontend version is `2.0.0-local-webgpu-merged-20260906`, OTA policy `none`. Install-over
succeeded and activity launch reported `Status: ok` in 11,789 ms. The strict readiness probe
then failed at its attach-stage body snapshot. A corrected full-budget 30-second cold retry
also failed: activity launch took 6,804 ms, no main UI or buttons were visible at 29,933 ms,
and observation timed out at 30,012 ms with the spinner still visible. Neither cold probe
reached its asset checks.

Separately, read-only inspection of the already-running APK passed all 26 installed-asset
hash checks, exact version/OTA checks, ORT import, WASM compilation and worker disposal;
the expected v2 welcome screen was visually checked. Its `inspectionPassed:true` is explicitly
not startup acceptance (`passed:false`, `coldStartAccepted:false`). Eventual welcome rendering
at 194,417 ms of navigation time also does not meet the cold-start deadline. Requests from
that September 6 APK showed the configured private backend was unresolved in the emulator,
without isolating DNS as the entire startup cause. Its WebView 151.0.7922.199 exposed WebGPU
but returned no default or high-performance GPU adapter. These are historical observations,
not a current network or GPU capability check. No model inference, physical-phone, account/model-retention
or authenticated app-card pass is claimed. Network settings were not changed.
Both this artifact and the older `551265bbe` APK are historical, not the current source candidate.

The build required a scoped 29.8 MiB Tauri package-cache refresh so vendor code generation
emitted the new namespace's activity and ProGuard files, plus process-only
`kotlin.incremental=false` for a cross-drive cache exception. No generated app code was copied,
and the old APK/native artifact was preserved. This local build does not need publisher
credentials or publication approval; it does not establish the remaining scoped acceptance below.

### Historical publication-gate snapshot (superseded by the September 14 handoff)

The dated evidence below is retained for provenance. Its shared-prompt requirement,
unreplaced-workflow blocker and pending advisory approval are no longer current: separate
app-owned prompts were selected, scoped workflow/source-review checks completed, and
inherited advisory findings were documented and deferred at the user's request. Current
phone, final source hygiene and exact-head hosted acceptance remain separately tracked in
the current handoff and readiness document; do not reopen superseded approval requests.

The existing PR remains on its older published head and includes no reported hosted checks.
The separated stack is committed locally, with its validation boundaries above. Refresh the
existing draft PR with the reviewed stack, then obtain hosted evidence for those exact heads
before changing readiness. Do not present the old combined checkpoint as an app-interface-only
refresh or silently activate production capability gates.

The selected **54 app/model integration tests now pass**, subject to their recorded source
identities; the existing ignored capacity test remains unexecuted. Do not rerun the historical
465-test full-suite attempt as a scoped requirement. Remaining gates include shared-prompt
source accuracy, final-head hosted checks and an
authenticated phone flow covering linking/reconnecting, exact app-authored card verification,
confirmation and delivery. Relevant backend compatibility and authorization remain mandatory;
production rollout is a separate publisher action, not a local-test prerequisite.
Dependency review is limited to app/card or model changes and their introduced or changed
dependencies. The mirrored scoped Rust advisory transport and offline SBOM exporter
now pass a fresh combined **160/160** implementation tests per PR (zero skipped),
including the local-source snapshot identity regression. Evidence is recorded in
`<project-temp-root>/admin/rust-feature-implementation-offline-20260909.json`
(SHA-256 `24986cf96ee37616650c8c104825df86455782bdcaffd8035fdeac671b1f32c9`).
No actual advisory query, official CycloneDX schema validation, current project
SBOM export or hosted-CI acceptance is established by these offline tests.
Preserve historical broader baseline/advisory findings without claiming a waiver
or feature security clearance; do not treat unrelated core findings as scoped blockers or run
new core/whole-lockfile audits. Publisher signing/version requirements are also outside the
requested locally signed test-APK deliverable.
Before pushing, replace the remaining explicit whole-lockfile advisory workflow steps with
feature-scoped checks. The separate nine-file offline inventory/CI test step is already wired;
it does not make the whole workflow pass. Implicit install audits are disabled, and an early guard rejects
legacy audit/SBOM/default modes before baseline reads, subprocesses or network activity.
The existing advisory steps remain blocked, not passed or silently skipped. Explicit license
metadata resolution is locked and offline; historical baselines remain unchanged.
The subsequent feature-only advisory egress request was rejected by the approval gate and is
awaiting explicit user approval. No advisory query succeeded, no whole lockfile was uploaded,
and no fallback or permission bypass was attempted; offline helper/inventory results are not
advisory acceptance. The approved RAM socket run now passes all 54 selected ordinary tests,
with one existing ignored capacity test unexecuted and source/cleanup checks complete. Bounded
runtime/test-source inventory pins were refreshed and their targeted guards pass 8/8.

Rust feature extraction and request-plan validation are complete offline for eight profiles:
PR1 owns four metadata profiles with 183 unchanged dependency inputs; PR2 owns four with 190.
`<project-temp-root>/tmp/rust-advisory-offline-plans-e8cUoE/summary.json` records 474 PR1 and
473 PR2 registry queries **planned, not sent**, with seven Git identities separately unqueried
for each. `rootCompletenessVerified:false` remains a bounded-coverage disclaimer; no concrete
additional missing root was identified. It is not authority to expand this release into optional
development tools, unchanged core fixtures or a general native C audit. Preserve unqueried-source
and feature-union limitations without claiming current feature security clearance.
See [release readiness](model-app-readiness.md) for the exact snapshot and required sequence.
This draft does not request production activation or claim release readiness.
