# Refreshing the existing two-PR stack

Assessment: 2026-09-07. This is a scope map and work log, not a completed split or a ready-for-review claim.
Keep both existing PRs in draft while the dependency and runtime gates are unresolved.

## Current reconciliation snapshot

The sections below retain the earlier refresh history. Current PR1 is based on
`2a95a68ca93be77a8e5cff92220fba0f54684d4a`, with uncommitted generic Android component,
optional build-defaults and sign-in cancellation/error-routing follow-ups. Its latest full
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

PR2's working tree merges that committed PR1 base into `6be70333c1cea2da6986de48afd77f55ecabe1ba`.
Its 77 conflicted paths have source resolutions but still have unmerged index entries;
the merge is not committed or pushed. The combined source passes 190 frontend files / 2,550
tests, Svelte with 0 errors / 562 warnings, agent TypeScript, and read-only ESLint with 0 errors /
31 warnings. The current September 7 offline build/policy aggregate passes 296 regressions
with none skipped (`node --test --test-reporter=spec 'scripts/*.test.mjs'`, native exit 0;
locally observed terminal output, not a saved aggregate log).
The complete locked/offline backend unit workspace now passes 957 tests with 0 failures and
1 existing ignored test, retaining the original exclusions for integration tests and the two
native-shell packages. Full strict backend Clippy also passes the locked/offline workspace
with `--keep-going --tests -- -D warnings`, excluding only the two native-shell packages.
Its scope includes integration-test compilation, not execution. Recorded manifest, lock,
workflow and monitor hashes were unchanged; process-local MSVC/`Path` setup corrected the
launcher failure without weakening a source gate. Actual Candid parity, integration execution,
hosted CI and rollout acceptance remain unverified.
The combined source has also produced a locally signed test APK.
The September 7 APK includes the welcome and auth-display fixes. Three actual emulator
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

## First isolated refresh slice

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

## Model-only refresh: local validation complete

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

## Pinned comparison points

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
