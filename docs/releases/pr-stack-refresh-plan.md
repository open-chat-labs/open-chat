# Refreshing the existing two-PR stack

Assessment: 2026-09-14. This retains the earlier reconciliation history and separates current local evidence from publication/runtime gates.
Keep both existing PRs in draft while the dependency and runtime gates are unresolved.

## Current local handoff

The latest cleanup APK is `OpenChat-local-test-cleanup-20260914.apk`, SHA-256
`d5e28646738a8d7c79d022d00ec0f4cad0194e08f607ed4b2f0af65d2735529c`.
Its source-bound local build, emulator cold startup (4.2 seconds), 26 installed assets,
and catalog/version checks pass. Emulator GPU inference is not qualified: its WebView
returns no adapter before model execution. A fresh physical-phone check remains required.

The earlier catalog-enabled APK was exercised on the physical phone. Its SHA-256 is
`086befb3049b85f8c2864e98d0112fb5776749bde25240ee602dabf18eee98d5`.
The APK accepted a configured, pinned Qwen candidate via its HTTPS catalog controls without
an APK or runtime-code change. Two Gemma image proposals and three consecutive Qwen image
proposals opened verified, source-correct app cards. Both Qwen runs under the corrected
observer closed their workers after cleanup. No model-weight requests were observed during
those proposals. Cached Gemma/Qwen return switches also complete without downloading weights;
a fresh post-switch Gemma proposal also passed. The optional audio add-on remains uninstalled.
This is bounded physical-device evidence,
not broader accuracy, delivery, audio-inference or final-stack acceptance.

The current feature-CI checker passes the scoped Rust/SBOM workflow replacement in both
slices. Both bounded source-review receipts and their fresh offline collections now pass;
this is not live advisory clearance. No core-wide audit was run or waived.
Exact-source advisory coverage is complete; inherited findings are documented and
deferred at the user's request, with the original gate results retained. Final source/PR
hygiene and exact-head hosted checks remain open. Keep draft status.
See [current readiness](model-app-readiness.md#model-cleanup-verification-follow-up--september-14)
for artifact-bound results and remaining gates. No publisher signing or production rollout
is required for the requested local-test APK.

### Historical September 12 handoff

The following APK, prompt and device-state statements retain their original September 12
scope and are superseded by the current handoff above.

Local heads remain PR1 `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b` and PR2
`d7b94d8649951a5b7d4f46b7d216d41734dd4cf7`, with additional uncommitted model/app-card
follow-ups. September 9's GitHub recheck still finds the old draft PR heads (`045f7132e`
and `c7299aa11`) and no reported check runs; the local stack has not replaced them.

The latest inspected local-test APK is `OpenChat-local-test-prompts-20260911.apk`,
78,662,410 bytes / SHA-256
`8129fb21ea40a365394541513d6a392bcc33b96a29abe31c22f46a11d23ad05b`.
Its file identity was rechecked September 12. It predates the configurable catalog and final
bootstrap/packaging correction; a new local-test build is still required. Earlier APK/emulator
receipts retain their own source/artifact scope and do not qualify the current working tree.

The catalog's model-only PR1 port is complete: 661 PR1 / 667 PR2 model tests pass across
32 suites each, both full frontend type checks have zero errors, and independently built
model workers are byte-identical. Actual shared catalog controls pass browser import,
storage/reload/removal/refresh and mobile-width checks. The separately reviewed direct-feature
ownership snapshots cover 51 model source/evidence paths per PR plus 44 app/card paths in PR2,
retaining the existing 18/17 dependency roots. Combined offline CI/ownership selections pass
155 PR1 / 213 PR2 tests; the current app contract selection passes 479 host and 295 focused
partner-app tests. No broad core/advisory audit or release acceptance is implied.

Qwen's latest mixed-precision v17 screen is 7/8 source and offline card fields, not qualified.
The missing receipt currency, physical-device checks, live card delivery, prompt activation,
new APK/server deployment and remaining scoped release gates are still open. No phone is
currently detected by ADB. See [current readiness](model-app-readiness.md) for exact receipts
and limitations. No publisher signing, upload or production rollout is required for local APK testing.

## Historical September 7 reconciliation snapshot

The sections below retain the earlier refresh history. PR1 reconciliation was committed at
`b461c4b7a3b59daa1d1a4aace002e1d3ffa55d57`, including the reviewed generic Android component,
optional build-defaults and sign-in cancellation/error-routing follow-ups. Its pre-commit full
frontend rerun passes all 123 files / 1,488 tests and 94 offline helper tests, with no skips;
Svelte reports 0 errors / 558 warnings, agent TypeScript passes, and read-only ESLint reports
0 errors / 30 warnings. The run matched the independent 37-file follow-up review inventory
and preserved all 46 recorded source/lock/configuration inputs and the dirty path/status set.
Startup recovery and credential-cache hints
were not blindly copied into PR1: those behaviors require prerequisite features absent
from that branch and remain an explicit scope difference, not a missing PR1 timeout fix.
PR1's mixed-owner protection required an explicit developer-approved trust exception for
owner-context Git inspection. The exact-checkout, per-command exception is now approved;
ownership, ACLs and global Git settings remain unchanged. This permits inspection, not
automatic acceptance or resolution of the index.

PR2 reconciliation was committed at `cdceb9d127a329b49a82795662fadba77ab2f18f`, tree
`1e3386eb094d12707953cb670c9a38520a663208`; its ancestry includes the reviewed PR1 head above.
Both checkouts were clean afterward, with no unmerged index entries. Nothing was pushed.
The pre-commit combined-source validation passes 190 frontend files / 2,550
tests, Svelte with 0 errors / 562 warnings, agent TypeScript, and read-only ESLint with 0 errors /
31 warnings. Subsequent sequential offline Node helper runs on the exact committed heads
passed 94/94 for PR1 and 296/296 for PR2, with no failures, skips or cancellations and native
exit 0. HEAD, tree and clean status were unchanged. Saved summary and logs:
`postcommit-node-helpers-20260907-8d38a451833749408c13f7c72e5b76a2/summary.json`.
Those post-commit runs cover Node helpers only; earlier frontend/backend results retain their
recorded source-snapshot scope.

The follow-ups, validated before commit as changes atop PR2, restore shared ActionCard
declarations and the user-index private-match redemption method/recipient scope to match existing Rust, without runtime Rust
changes. Their source-contract suite passes 38 tests, including exact method-name sets for
all 25 interfaces and omission/duplicate/renamed-state controls. Frontend policy now explicitly
executes that suite for Rust/Candid-only changes. The full follow-up helper aggregate passes
336/336 with no skips; scoped formatting passes. All 207 recorded inputs and HEAD/dirty status
remain unchanged during the run. Evidence:
`candid-contracts-all-apis-final-20260907-c8d69fd637234e51816036356c7a0852/summary.json`.
These are changed-source checks, not post-commit or semantic parity acceptance. Separately,
the complete actual parity rerun after all fixes passes: 25 generated interfaces and 50 strict
bidirectional comparisons, native exit 0, with all 2,879 recorded inputs and the Cargo lock
unchanged. Evidence: `backend-candid-parity-runs/launch-fce066b6cd434a5d81dd22583dec9c56/summary.json`
and its nested `run-475e62309c1b4d729e248875e99ba0bf/completion.json`. This result covers the
working declaration fixes atop the PR2 commit, not the commit alone. The reviewed local APK
was subsequently built from clean follow-up commit `e3d2cb91a426c67c6bcef0c5f664999e1676fb16`;
emulator startup and all 26 installed runtime assets passed. See the exact-artifact record
in [current readiness](model-app-readiness.md#reviewed-local-test-apk-september-7).
Interface parity and this smoke test are not integration, hosted or physical GPU acceptance.

The complete locked/offline backend unit workspace now passes 957 tests with 0 failures and
1 existing ignored test, retaining the original exclusions for integration tests and the two
native-shell packages. Full strict backend Clippy also passes the locked/offline workspace
with `--keep-going --tests -- -D warnings`, excluding only the two native-shell packages.
Its scope includes integration-test compilation, not execution. Recorded manifest, lock,
workflow and monitor hashes were unchanged; process-local MSVC/`Path` setup corrected the
launcher failure without weakening a source gate. The separate Candid parity pass is recorded
above; integration execution, hosted CI and rollout acceptance remain unverified.

Separate Windows native checks pass both shipping feature combinations and the 27/41
library-test selections. The explicitly selected real-text fixture test also passes on CPU;
it checks non-empty generation, not answer quality or phone WebGPU. The CI-count repair
passes 96 PR1 / 338 PR2 offline helpers while dependency-policy failures remain. See
[current readiness](model-app-readiness.md) for source boundaries and receipts.

The earlier combined source also produced a locally signed test APK.
That historical September 7 welcome APK includes the welcome and auth-display fixes. Three actual emulator
cold starts passed in 2.25–3.46 seconds to first observed readiness; all 26 installed assets
matched on each run. **That APK predates the final worker-logging and mobile-theme fixes;
it must be rebuilt and retested before representing current source.** Its cold-start passes
accept only the recorded welcome artifact. No model was downloaded or executed, and signed-in
account/model retention, passkey providers, app-card flows and physical-device inference
remain unverified.
These are local artifact results, not acceptance of either final PR head. Publisher signing, store
versions and uploads are outside this local-test
request. See [current readiness evidence](model-app-readiness.md) before using any of the
historical results below as an acceptance claim.

The latest shared CI follow-ups pin the nine component-contract tool artifacts, execute
the actual Kotlin/Android SDK component checks, and lock all six native Cargo commands.
PR2 additionally fixes backend PR-filter permissions and the action-inbox validator's
numeric-prefix false positives; its 48 shell regressions are now included in hosted policy
coverage. These are local source/test results, not successful hosted runs or backend rollout.

The AAB release verifier also checks base-manifest package/version identity using the
size/SHA-256-pinned standalone bundletool 1.18.1 before its existing signature checks.
Its pin records locally measured official-download bytes, not a publisher checksum.
The offline release selection passes 103 tests in locally observed terminal output;
11 additional actual-tool cases accept/reject synthetic aapt2-compiled manifests as expected
(`aab-manifest-real-tool-tfZsvO/summary.json`). No production bundle, publisher signing,
installation or upload was accepted by those fixtures.

The final merge review retained upstream error filtering and primary-error grouping while
preserving PR2's worker telemetry redaction. Seven real-worker/shared-logger regressions pass
after six failed before the fix; the adjacent worker/error selection passes 33 tests. Generic
mobile status/spinner tokens were also migrated to actual emitted theme variables, with eight
dark/light compiled-style/render regressions passing after an eight-test red run. No model,
app interpretation or authentication behavior was changed, and no PR2 app controls were copied
into PR1. Both fixes are included in the final 2,550-test frontend validation; 62 recorded
source/lock inputs were unchanged throughout that run.

Current receipts: `pr2-frontend-validation-20260907-cf114059659944cf8bd4db45b0016619/summary.json`,
`pr1-frontend-validation-20260907-auth-display/summary.json`,
`backend-unit-runs/run-f4b0d6a9c33747b4b6ee2e23b49858f7/completion.json`,
`backend-clippy-runs/launch-1b806ddff30e473fae987a5241dda4bb/run-fbbac4b6573940f5a52a03b5fde0f67e/completion.json`,
`pr2-resolution-review-SKfjgo/worker-logging-green.json` and
`pr2-mobile-ai-theme-green-20260907.log`. The readiness document links these source results
to the separate exact-artifact startup evidence and remaining release gates.

## Historical first isolated refresh slice

An isolated `codex/pr1-refresh-local-build` worktree now starts at the exact published PR1
head below. The first slice transfers only portable OTA ZIP packaging: literal `execFile`
arguments, Windows UTF-8 ZIP creation and archive regression tests. It deliberately excludes
the app-side `includeLocalExtractor` payload changes and leaves the native-platform guard
untouched. Its dependency fixture matches PR1's existing `fs-extra@8.1.0`; no package or lockfile
update is needed. Commit `a6fedf3e0` records this three-file slice locally: four Windows tests
pass, including the actual plugin's store/full ZIP outputs, config injection, asset bytes and
exclusions. Its frontend CI prerequisites now match the existing PR1 Node policy and pinned
`dfx` version, check frozen Rollup resolution and run the archive test. The complete PR1 build
and hosted CI have not run; this isolated branch is not pushed.

This starts the append-only refresh; it does not establish whole-PR acceptance, change either
published PR head or reconcile upstream.

## Historical model-only refresh: local validation complete

The next isolated slice carries the all-WebGPU Qwen/Gemma runtime, optional audio, model-cache
identity and lifecycle, both model-manager UIs, generic build delivery and matching notices.
It uses a fresh install of PR1's exact npm lockfile; runtime package pins are unchanged.
Real worker builds and model asset/notice emission have passed separately from inference.
The app-card evidence hooks, OCR controls, app-processing protocols and local development
identity/OTA settings are excluded by hunk, not copied into the model-only branch.

Review found two cross-layer requirements that helper tests alone missed: native model-list
responses must carry per-file identity for the new installation-status UI, and optional voice
support needs an actual generic `/ai` caller, not only an inference API. Both are now included.
Both composers retain captured viewer/chat/thread guards and support staged or explicitly
replied media through bounded generic readers. The native availability probe prevents old or
feature-disabled shells from advertising inference they cannot run. Mounted settings tests
cover stale optional-audio completion after model changes and destruction.

The public media bridge keeps image-only defaults and requires explicit audio opt-in. Its
anonymous no-retry transport retains one deadline through response-body consumption; stalled
body and early-rejection cleanup regressions cover the actual reader/transport helpers.
Unsupported audio never silently becomes a text-only native or legacy browser request.

Independent local checks pass: 66 frontend suites / 872 tests, Svelte and agent type checks,
read-only lint, actual worker emission, 18 default native tests and strict native Clippy.
The exact expanded model CI selection passes 31 suites / 452 tests; its generic Node policy
step passes 32 tests. A regression proves the previous invalid workspace command fails.
Model package versions and dependency lock remain unchanged; package script edits only add
read-only CI linting. The native feature-enabled local build is not accepted: SDK access was
denied, so only the verified default-feature result is claimed.

The model-only refresh is committed locally as `dc57e67ef7a6a7167fdf2a1fb6c23511a8bfe599`,
followed by a narrow imported-notice whitespace rule at `a26f51692b0f3505f728f4a294f6e9d32648abd5`.
Neither commit is pushed. These checks are not complete upstream/PR acceptance or physical-device
inference. A fresh exact-lock audit reports 20 affected package entries overall (10 high,
9 moderate, 1 low), including four high model-introduced entries. Six inherited findings are
already repaired in current upstream. These findings require actual remediation, not a
review-baseline waiver. Current-upstream reconciliation, production build validation and
the append-only stack refresh below remain outstanding.

## Historical pinned comparison points

- PR1 model head: `045f7132e502ba01c56343800217070aa2ce4ea0`.
- PR2 app-interface head: `c7299aa11b87fbfd56029fc90e05e423654f54f1`.
- Combined checkpoint: `2029f00d726ca7c33de22c53c24cf1ada173d3fb`.
- Rechecked upstream master: `df9d9ed52db00e87fbb7309280a325902c9bb2cc`.

The checkpoint is 16 commits / 115 changed files past PR2, and 60 commits past PR1.
PR1 is an ancestor of both. Upstream and checkpoint have 126 and 98 unique commits;
upstream integration and conflict resolution remain untested. Re-read remote refs before work.
Upstream's Android rename/signing association and legacy-install notices need explicit account,
local package identity and OTA compatibility review; do not resolve them with a blanket overwrite.

## Scope by area

Paths below are relative to the repository; globs include corresponding tests. Classification
is by responsibility, not permission to copy an entire commit or directory without review.

| Area                                                                                                                            | Destination                  | Review requirement                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `frontend/app/src/utils/transformersWebGpu*`, `gemma4WebGpuEmbedding.ts`, inference worker, sequential-session build helper     | PR1                          | Preserve GPU lifecycle, embedding identity and optional audio fixes together                            |
| `modelCatalog*`, `onDeviceInference*`, `webInference*`, native model manager and model command/types                            | PR1                          | Preserve cached installations and keep readiness distinct from selection                                |
| Both `ModelManager.svelte` components and shared runtime settings                                                               | PR1, mixed UI hunks reviewed | Do not import app action structures into the model-only head                                            |
| `appLocalProcessor*`, `aiAppReconnect*`, `privateMatchSurface*`, `cardBridge*`, action card components, app link sheet          | PR2                          | App-owned interpretation, content attestation and scoped linking remain together                        |
| `aiActionRunner*`, `aiActionAvailability*`, `aiActionProposalReadiness*`, local command/message/menu flow, shared action schema | Mixed                        | PR1 owns generic inference; PR2 adds registered app routing and action construction                     |
| `browserOcr*`, `inferenceImage*`, local extraction, image mode settings                                                         | Mixed                        | Evidence/runtime plumbing may be generic; app-specific interpretation must stay outside this repository |
| Startup, home routes, chat/message/image components, toasts, build configuration, translations                                  | Mixed                        | Attribute individual hunks and tests; verify both UI versions                                           |
| Passkey bridge, identity model, native onboarding, client authentication                                                        | Shared prerequisite          | Prefer a small isolated prerequisite or generic PR1 commit, then inherit into PR2                       |
| Backend capability redemption update and local app-processing protocol docs                                                     | PR2                          | Preserve exact authority/content checks; never loosen for UI success                                    |
| Model illustrations                                                                                                             | PR1                          | Documentation must match actual shipping versus development runtime                                     |
| Lint, compatible dependency patches, portable hashes and CI/release guards after checkpoint                                     | Shared tooling               | Carry generic portions first; PR2-only policy files and historical tests stay on the app stack          |

Candidate model-focused commits include `97ab1e985` (decoder compilation), `42e519e10`
(embedding identity), `1212f2d8d` (optional audio), and `9614e9c64` (model illustrations).
They still require dependency/hunk review; their titles are not proof of independent applicability.
Reconnect viewport commit `b2c3e6f6b` and app-boundary checkpoint `2029f00d7` belong to the
app review. The remaining commits touch shared runtime/UI concerns and must be split by hunk.

## Append-only refresh sequence

This is the original scope plan. Local reconciliation and reviewed PR1 inheritance are now
committed as summarized above; publication and remaining acceptance gates are not complete.

1. Use isolated worktrees from the exact existing PR heads. Preserve the combined integration
   branch and immutable checkpoint as reference, not as a new PR2-only head.
2. On PR1, apply generic runtime/model hunks and their tests from the checkpoint, plus generic
   preparation fixes. Keep PR2 protocols/types out. Validate source imports, model tests,
   frontend checks, native tests and the PR1 dependency review independently.
3. Append the reviewed commits to PR1. Merge that resulting head into the existing PR2 history
   (do not rebase a published branch without agreement). Resolve shared files against the
   checkpoint's final behavior, then append only the missing app/interface hunks and tests.
4. Compare the resulting combined tree to the tested checkpoint plus preparation. Explain
   every intentional delta. Re-run app/host boundary, full frontend/backend and live card gates.
5. Reconcile current upstream in the model branch, merge the updated model head into PR2,
   and revalidate. Do not resolve conflicts by replacing whole upstream files with old copies.
6. Push each refreshed existing branch only after its own checks pass; update existing PR
   descriptions. Require hosted checks for both final heads and the exact shipping commit.

Read-only starting commands:

```sh
git diff --name-status c7299aa11 2029f00d7
git log --reverse --format='%h %s' c7299aa11..2029f00d7
git diff 045f7132e 2029f00d7 -- frontend/app/src/utils
git rev-list --left-right --count upstream/master...2029f00d7
```

Do not blindly cherry-pick all 16 commits into PR1 or fast-forward PR2 to the mixed integration
branch and describe it as app-only. This plan neither rewrites history nor waives the
[release readiness gates](model-app-readiness.md).
