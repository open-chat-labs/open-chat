# Draft update: optional on-device inference and local model management

Target: existing [upstream PR #9132](https://github.com/open-chat-labs/open-chat/pull/9132).
Keep draft status. This handoff records the model-only source slice; publishing and hosted
check status must be verified against the exact remote head, not inferred from local tests.

## Verified hosted checks — September 15

The published model head `3ea234c43c576c664bce669354784d2a5d3883ce` passed
[full frontend CI](https://github.com/ktimam/open-chat/actions/runs/34980936411)
(1,975 tests), production WebGPU distribution verification, and the frontend,
Android and Linux/Windows native jobs in
[model CI](https://github.com/ktimam/open-chat/actions/runs/34980936382).
The model-only frontend selection passed 972 tests; native tests passed 18 per OS,
and the real-inference check passed. These are exact-head hosted results, not
substitutes for application accuracy or phone acceptance.

The overall model workflow is still red because its separate scoped dependency
check failed. The approved diagnostic subsequently received a valid JSON body
without a Content-Type header or duplicated inner package names, which the collector
rejected. The collector compatibility fix and offline regressions now pass locally;
this does not clear or suppress an advisory. The separate Sharp patch passes its
42 image API compatibility checks; relevant installs skip unused optional Node GPU
downloads. The unpatched adm-zip finding remains open for a separate disposition.
These follow-up changes are not yet published or verified by a new hosted run.
The ten previously recorded Rust findings remain documented/deferred.
See [the scoped npm follow-up](npm-feature-advisory-triage.md).

The following CI-repair narrative records the preceding local checkpoint.

## September 15 CI repair checkpoint

The first publication reached `656859b54cba959e7bcca018664e92522a51caad`.
Its hosted failures were actionable CI/test defects, not completed acceptance.
The follow-up candidate removes explicit `any` from Qwen test fixtures and checks
large tensors/graphs with complete native byte equality. Assertions, all geometry
cases, production runtime, model weights and timeout ceilings are preserved.

Collector validation now uses the exact CI Node 24.18.1 / npm 11.16.0 bundle, with
reviewed Arborist 9.7.0 / semver 7.8.1 semantics and a real, network-blocked offline
smoke before any advisory request. Android setup explicitly requests platform-tools,
not the retired tools package. Formatting uses the reconciled upstream boundary;
any inherited style exception binds the full candidate and upstream source bytes,
formatter versions and configuration. It is not a blanket core-path exclusion.

The complete local frontend rerun passes **1,975/1,975 tests across 139 files** on
Node 24.18.1, with no skips. Full frontend lint has zero errors (30 existing warnings),
and both frontend and agent type checks pass. The exact checked-in offline helper
selection passes 685/685, without skips; scoped formatting passes for 146 files.
Initial failures from pruned local dependency files
and their unchanged-source reruns are retained. The four directly repaired Qwen
suites pass 161/161 independently in both slices. Exact-head hosted reruns remain
required; these repairs do not establish model accuracy, advisory clearance,
phone delivery or release approval. No application prompt or shipping inference
behavior changes in this repair.

## Historical September 15 pre-publication checkpoint

The selected PR1 frontend contracts pass 972/972 tests across 49 files, and the selected
offline CI/packaging helpers pass 590/590, with no skipped tests. Source ownership and
executable feature-CI wiring pass. Local Node is 24.14.1; hosted CI pins 24.18.1, so these
results are not exact hosted-runtime qualification. Initial local dependency failures and
their successful unchanged reruns are retained in the private check record.

The combined cleanup APK (`2.0.0-local-webgpu-cleanup-20260914`) now passes three consecutive
fresh smaller-Qwen image proposals on the physical phone, including a repeated image, with
model-only selection, WebGPU inference and completed session/worker cleanup. Both retained
models remain available; the diagnostic mixed weights and download route are retired. This
does not qualify an independently packaged PR1 APK, every image, optional audio, or delivery.
Application prompts, domain expectations and raw acceptance fixtures remain app-owned.

The user-approved inherited-advisory disposition remains documented/deferred. Ten recorded
findings and their failed conservative gate are not suppressed or called clean. No core audit,
new advisory query, production activation or publisher-signed release is part of this step.
Exact-head hosted CI/review and the separate broader image-note mismatch remain outstanding.

The reviewed commit candidate contains only model/runtime, tests, scoped CI and documentation.
Fifteen pre-existing unrelated working-tree deletions are deliberately not staged. The earlier
dated narrative below is historical; stale 'latest/current' labels there do not override this
checkpoint. Local evidence: `admin/final-pr-checks-20260915.json`.

## Historical checkpoints

Earlier phone evidence (September 14): the combined local-test APK accepted a new pinned model
through catalog configuration and completed three consecutive Qwen image proposals. The
existing Gemma model remains cached and reusable. This is evidence from the combined APK,
not an independently packaged PR1 artifact or broad model-accuracy qualification. All learned
model stages are configured for WebGPU; CPU preprocessing is not claimed to execute on GPU.
Application prompts, domain fixtures and semantic checks remain app-owned. The earlier
shared-prompt investigation is historical; model-specific app configuration now lives in
the app and PR2's generic interface, not in this model-only slice. Feature-scoped Rust CI is
now wired, and the bounded source reviews are complete. Advisory acceptance and final
source/hosted checks remain incomplete. See the
[current acceptance record](model-app-readiness.md#current-configurable-webgpu-model-catalog).

September 14 user-directed disposition: the user requested documenting and skipping
further inherited-advisory decisions. The ten findings are retained and deferred
for this scoped local preparation; they are not a further user-approval blocker.
Raw failed advisory results remain unchanged. No finding suppression, dependency
update, core edit or scanner-gate change is made, and no clean-scan or upstream
release-policy acceptance is claimed.

September 14 approved advisory follow-up: the explicitly approved PR1 invocation
completed one authenticated OSV request for **481 selected dependency identities**,
including seven Git-pinned packages, with zero unqueried identities. Collection,
reviewed scope, unchanged sources, SBOM validation and complete responses pass.
It returned the same ten advisory/package/version tuples already triaged in PR2:
nine unmaintained-package notices and one RSA timing vulnerability in the selected
Windows integration-test context. The exact package versions/checksums already
exist in both pre-PR lockfiles; that is not a waiver or an exploitability assessment.
The conservative advisory gate therefore exits 1 and remains failed. No new
findings relative to PR2 were observed; empty Git results do not prove index coverage.

The completed PR1 summary is project-temp
`output/rust-feature-ci-xLvzhv/summary.json`, SHA-256
`64824d53be0ca74e591b374802d1bf280326891bd1bf35e2aeef9a486a615a95`.
The previous PR1 permission blocker is resolved for this invocation. Runtime,
model configuration/cache, APK, server, core source and publication state are unchanged.

September 14 model-cleanup follow-up: three Qwen runtime helpers now return results and
propagate cleanup-only errors after their cleanup blocks. Original native failures, tensor
ownership, disposal attempts and release ordering are preserved. No prompt, model setting,
dependency root or app/domain logic changed. Expanded cleanup tests pass before and after
the refactor (123 tests); the selected PR1 suite passes 972 tests. Scoped runtime lint and
frontend type checks have zero errors; existing unrelated warnings remain.
The combined stack passes 1,782 selected model/app tests and emits the production model
worker. The previously phone-tested APK predates this source change and is not a new-source
qualification. The combined local APK has now been rebuilt and passes emulator startup,
installed-asset and catalog checks. Its emulator WebView returns no WebGPU adapter, so fresh
GPU inference/phone verification and remaining release gates are still open. PR1 has not
been independently packaged by this combined-stack check.

September 14 scoped Rust inventory: the model-only configuration now includes the exact
local ARM64 `transformers-webgpu-android` profile with 13 model/IPC/build roots. Fresh
locked, offline Cargo metadata resolves only that app feature and no plugin inference/store
feature; llama.cpp, Minijinja and devtools are absent from the resolved graph. All five
configured profiles collected successfully, with unchanged source/lock inputs. The scope,
seed and collector regressions pass **45/45**. This is an inventory of the local profile,
not a new APK build, full native binary inventory, advisory result or CI/release acceptance.
Existing profiles and dependency roots were preserved. The source-bound receipt is
project-temp `output/rust-feature-collection-0TwW8n/summary.json`, SHA-256
`e74b2f7aa4d353bf3de7d2789faf5613db63dcd994b10493f0a34e25f9245e93`.

September 14 shared-test follow-up: the model workflow now triggers on Rust scope/helper
changes. Two previously omitted group-index caller-side upload schema dependencies are
recorded as Windows-test-only edges, with regressions against shipping/Android leakage.
No core implementation or runtime dependency was added. The five focused scope/CI safety
suites now pass **155/155** in PR1. A fresh five-profile offline collection also passed:
`output/rust-feature-collection-56VJAc/summary.json`, SHA-256
`92268faabf8c0c97e0613ae44fcf0b7a9591030c9a7888a3abf19253a9427140`.
This supersedes the inventory receipt above for the updated test-schema configuration;
it does not change the APK or clear the pending Rust/SBOM CI migration.

September 14 SBOM follow-up: the collector now requires offline validation against pinned
official CycloneDX 1.6/reference schemas and writes a receipt bound to the exported bytes.
The real PR1 selected export (481 components) passes schema and graph checks. All exporter
fixtures and 24 malformed-document/schema cases exercise the validator; all offline
feature-policy suites pass **440/440** in PR1. Existing Ajv development tooling is used with
locked version/integrity checks; no runtime dependency or APK change is introduced.
Schema validity does not clear source-completeness, advisory/licence or release acceptance.

September 14 generated-owner follow-up: shared registration/setup/upload/subnet schema review
is now recorded. User-index registration adds three Windows-test-only Candid/Serde/ts-rs
roots; no production or Android model root changed. A new regression checks every pinned
direct ts_export consumer's own ts-rs edge, with owner-removal negative controls. All offline
feature-policy helper suites pass **441/441** in PR1. Fresh installed-Cargo collection passed
all five profiles with unchanged source/lock bytes, and the new schema-validation receipt
passed for the 481-component selected SBOM. Every profile's package identity set is unchanged
from the prior collection. Current receipt: `output/rust-feature-collection-EYJ9Zz/summary.json`,
SHA-256 `573f059139153175655b743f62ae5c3f5d69fc44ecaab86f35ebe6752241310c`.
The bounded source-completeness review and scoped Rust CI migration remain incomplete;
these helper/collection results do not qualify a release or new phone inference.

September 14 executable Rust CI: legacy broad Rust/SBOM workflow commands and scanner
installations are replaced by `scripts/rust_feature_ci.mjs`. Explicit pinned input
preparation precedes the retained offline direct-license gate. The full checker now requires
actual scoped execution and failure reports; tests no longer sanitize the workflow first.
All offline feature-policy suites pass **492/492** in PR1, plus 40 adjacent policy checks.

The real five-profile composition collected and validated its SBOM, then exited 1 at
`incomplete-feature-scope` before advisory egress. This is not security clearance.
Receipt: `output/rust-feature-ci-qObEVT/summary.json`, SHA-256
`dd6c1e2e25a7b3de1a736b450e007072913e7d81e77dbf382898628cb53b0327`.
The incomplete-inventory adapter still needs a genuinely reviewed completeness producer;
selected non-registry/advisory coverage and final acceptance remain open. Duplicate raw
metadata from this smoke was retired; identical originals and all selected reports/SBOMs
remain. No local install, runtime change, APK rebuild or publication occurred.

September 14 source-review contract follow-up: the collector now accepts a separate,
versioned [source-review receipt](rust-feature-source-review.md). It validates every
configured source and seed/profile disposition, exact owner/evidence references and all
gap resolutions against the pinned inventory. Stale receipts fail before subprocesses;
receipt drift invalidates an in-progress collection. The incomplete inventory API itself
is unchanged and still cannot grant completeness.

The positive path is exercised through actual collection/SBOM/CI code using offline
fixtures; fixture transport never grants real acceptance. All offline feature-policy
suites now pass **499/499 PR1** and **585/585 PR2**, and both full workflow CLIs pass.
No actual PR receipt was issued and no real Cargo/advisory run was performed in this
follow-up. Completing the substantive source review, exact-source advisory coverage,
model distribution and final release checks remains outstanding.

September 14 PR1 source acceptance: the actual versioned
`scripts/rust_feature_review.pr1.json` now records the completed bounded model-owner
review. Five previously unpinned module declarations are bound without adding any root.
The receipt covers **131 source files, 114 seeds and 200 seed/profile pairs** in 42
review units. The unrelated pre-existing DynamoDB worktree edit remains excluded.

A fresh installed-Cargo offline collection passed all five profiles, with unchanged
source bytes and an officially validated **481-component** selected SBOM. Its summary
reports `rootCompletenessVerified: true` and no unresolved source-review gap.
All per-profile package identities and raw metadata match the retained prior collection;
this is additional source-review evidence, not an expanded dependency scope.
Current receipt: `output/rust-feature-collection-PQNzna/summary.json`, SHA-256
`109f21ad1cb2eb4a5c9c3622f03b571ad4709a82892b62a8cf6ad568a43cb513`.
PR1's offline feature-policy suites now pass **500/500**.

The base inventory deliberately remains an incomplete inventory: the separately bound
review resolves it; no status flag was flipped in place. No advisory requests or actual
CI advisory run, model/default change, APK build, deployment, commit or push occurred.
PR2's later bounded source review is also complete. Exact-source advisory
coverage/authorization, model distribution and final release acceptance remain open.

## Summary

September 12 working-tree addition (not yet committed; now locally tested in the combined APK): the
[configurable WebGPU catalog](../webgpu-model-catalog.md) supports compatible model
addition/removal, artifact revisions, supported session precision, optional audio and
generation defaults through JSON import/refresh in both Model Manager UI versions.
Downloaded weights are retained. Empty/reordered bundled catalogs are supported without
coupling packaged adapter assets to the active model list. A new architecture still needs
a runtime adapter; application prompts and card semantics remain outside PR1.

Provide optional on-device model management and a generic inference interface for chat and
other host features. Keep model selection, installation state, cached artifacts, runtime
readiness and bounded failures visible to the user. Retain optional audio support without
requiring an audio download for image/text use.

The isolated model-only refresh includes browser WebGPU image inference, mobile GPU lifecycle and
compilation fixes, cache-preserving model switching, updated model settings, optional Gemma
audio, and Android/native bridge recovery. Its refreshed local commits have not replaced this
PR's published head; the combined integration checkpoint also contains app-interface work for PR2.

## Boundaries

- No third-party app imports, app-defined field semantics or domain-specific extraction.
- Models and runtimes are optional. Disabled/unavailable states remain explicit.
- Preserve pinned model assets, verification, license notices and bounded resource cleanup.
- Keep desktop/native and browser/WebGPU runtime claims separate.
- All-WebGPU phone inference is currently local-development-only; this PR does not claim
  that the existing production Android release workflow ships that path.

Two generic PR2 feature sets are intentionally not ported into this PR1 slice: development-origin
service-worker pre-mount cleanup/recovery, and the cached-credential hint bridge for native
passkey discovery. PR1 retains its existing lazy layout startup and nonblocking web-model restore.
It does not await the optional credential cache, so PR2's 1,500 ms cache deadline/cleanup fix is
not an outstanding PR1 defect. Introducing either prerequisite feature requires its own scoped
review; their absence is not a reason to copy broader PR2 startup or authentication changes.

## Verification and readiness

Latest status (September 9): local PR1 is `2c5c0b5a5b2d5c96c0522a0af88b6c1c5e0f162b`.
All five Windows native gates pass with `--locked --offline`: 18 default-feature tests,
`inference` and `inference,store` compile checks, 32 inference tests with four existing ignored
fixtures, and one explicitly selected real CPU-text test. All 456 recorded inputs and the
lockfile were unchanged. Evidence:
`tmp/pr1-native-gates/launch-40864d6bc3ae4da2888c79d94e6ef6d4/summary.json`.
The earlier full offline helper aggregate passed 104/104; the September 8 26/26 model-CI
selection is also historical focused evidence. The separate unfiltered frontend
**Check offline feature inventory and CI contracts** step previously selected nine files;
those helpers plus model-CI coverage passed **262/262** on PR1 and 304/304 on PR2.
It now selects eleven files, including the offline Rust response validator and owned-rule
regressions. Before the DeepStack follow-up, the eleven-file selections passed
**273/273 on PR1 and 331/331 on PR2**,
with zero failures/skips, entirely offline; neither result is full hosted CI. Four failing-first YAML-scalar
regressions are included. The guard validates the actual single-line run, each test omission,
commented/conditional/ignored execution, repository-root working directory and inherited shell.
This completes that bounded wiring check, not the whole CI workflow: old whole-lockfile commands
still intentionally fail closed, and hosted acceptance is pending. These native gates are no longer
pending, but do not establish Linux, vision quality, phone WebGPU or authenticated app acceptance.
GitHub recheck on September 9: published PR #9132 remains draft at `045f7132e`,
with review required and no reported checks.

Historical committed evidence: the isolated upstream-reconciled PR1 source at
`2a95a68ca93be77a8e5cff92220fba0f54684d4a` passed 120 frontend suites / 1,378 tests, both
typechecks, read-only lint and native default-feature tests. Its own frozen install was used
for separate real default and opt-in WebGPU production builds; emitted workers, directory
assets and both OTA archives were verified. Those results describe that committed source,
not the later working-tree changes.

Follow-ups now included in the local refresh add generic Android component registration that separates
installed application identity from source classes, optional `.env` defaults that preserve
caller-supplied values and reject invalid existing files, and native onboarding error routing.
Android cancellation now stays on sign-in; only a genuine no-passkey response offers linking.
An earlier follow-up snapshot passed 121 frontend suites / 1,403 tests, including 25 actual
onboarding-handler regressions; that snapshot predates the following startup/authentication fixes.

Historical source verification (September 7): the PR1 working tree passed 123 frontend suites /
1,488 tests, including the 25 onboarding-handler tests, 44 mounted authentication-error display
contracts and 41 mounted home-startup readiness tests. Anonymous-home authentication choices
no longer wait for chat discovery; the existing registered-account and public-route readiness
gates remain intact. Query-driven Home effects retain their mounted state, and V1 preserves
an active welcome form even when child controls stop event propagation. Native authentication
errors use the intended translated message instead of an unresolved translation key.
Svelte checking reports 0 errors / 558 warnings, and read-only frontend lint reports
0 errors / 30 warnings. The validation receipt records unchanged startup/authentication source
hashes across these runs. These are source-level checks, not device or packaged-build acceptance.

The September 7 build-policy/helper aggregate passed 94 tests, including real-shell
optional-defaults regressions. A separate Android
component-contract CI job now uses nine byte-size/SHA-256-pinned Kotlin/JUnit artifacts.
The actual cached tools separately passed 12 host tests, 7 real-SDK constant checks and
production-source compilation against Android 36. All six native Cargo test/check commands
now require `--locked`, preserving their platform/feature and real-fixture selections;
the resolver/CI-coverage subset passes 40 tests. These checks do not establish
physical-device authentication or model-inference acceptance.

The September 8 dirty runtime follow-up separates cached full-weight verification from stale
worker refresh, preserving previously downloaded models. Cached SHA updates are bounded to
64 KiB and yield a macrotask after 8 ms of hashing or 4 MiB, allowing UI work and cancellation
to run. Failing-first stale-worker, model-preservation and prequeued-stream starvation/cancellation
regressions are covered in the existing inference specs: PR1 passes 106/106 focused tests and
PR2 passes 111/111. ESLint reports zero errors and four existing catch warnings. This is source
verification, not an installed-APK responsiveness or repeated-inference pass.

### September 9 supplemental source-only checks

The later direct-feature ownership review covers each dirty model working tree's
40 files / 18 roots, including the staged-session transform helper. The reviewed
snapshots in `scripts/npm_feature_scope.pr1.json` are
`15b5f9c2aeca637788d71bf1b0474ec4e067c590240227aaf0b1955500e3bd7e` (PR1) and
`3aafb847e7aad846a15843fac6278050ecc88a59481aa48b6309767e7c923c96` (PR2).
The ownership-helper selections passed 31/31 and 58/58 respectively, and their CLIs
exited 0 (terminal-reported; no separate saved run receipt). This is dependency-root
ownership, not a new advisory scan, security clearance or runtime acceptance.

The fresh optional-audio/cache/composer selection passes 273 PR1 and 319 PR2 tests
(592 across both slices), with 33/37 recorded source inputs unchanged. Receipt:
`tmp/audio-cache-composer-20260909-g6cq4W/summary.json`. These source tests overlap
earlier selections and did not run audio/model inference, downloads or phone flows.
Optional voice-message inference and retained account/model state remain unverified.

### September 9 Qwen mRoPE and DeepStack source corrections

Subsequent source safety fix: the pinned decoder has a 1,024-position causal table,
not the tokenizer metadata's larger context window. Both workers now reject
processor-expanded requests when prompt tokens + effective output allowance - 1
exceed that actual capacity, before any generation forward; they do not truncate
the prompt or silently reduce the requested output. Malformed batch/length shapes
also fail before generation, and input tensors still dispose on failure. Gemma is
unchanged. Failing-first execution of the real worker function exposed five
failures; the final 37 focused tests pass in each PR, including an independent
check of the delivered graph's table and scalar dimensions. The 26 model-CI
discovery checks and scoped TypeScript/ESLint checks pass. This is not phone
acceptance or a new full-model accuracy claim.

The generic pinned-decoder transform now targets interleaved mRoPE frequency selection.
Its mRoPE-only intermediate decoder is 5,085,647 bytes, SHA-256
`29df8b402b9dc86a3e2683911f1e4a28067f12713ae3c1715851feb0e39b20e3`;
the pinned source graph and external weights remain unchanged. Isolated CPU and deployed-version
WASM numeric checks passed. A separate desktop WebGPU run verified the actual non-fallback
Nvidia Ampere ORT device and the selector kernels with CPU fallback disabled, including
bit-exact equal-axis controls. The full positional-cache numeric checks allowed CPU fallback;
they are not evidence of fully GPU-resident decoder execution.
Receipts: `output/qwen-mrope-isolated-20260909-aeacf92e-8d42-4229-bfba-e66794e4aca3/result.json`
and `output/playwright/qwen-mrope-desktop-20260909-TaOt3Y/result.json`.

These are weight-free isolated graph checks, not full-model image accuracy or phone acceptance.
The pinned upstream export lacks DeepStack; the mRoPE-only correction did not restore
those learned mergers. That earlier reviewed source-owned snapshot covered 36 files
and the same 18 model dependency roots; the existing ONNX parser/build
dependencies are reused, with no new dependency roots or advisory queries. Both source slices
also passed 26 focused Vitest regressions and 12 asset-notice checks; the new-test typecheck,
read-only ESLint (zero errors) and formatting passed. These checks do not qualify image accuracy.
That intermediate reduced the complete download footprint by 1,734 bytes to **1,534,531,101 bytes**.
Production progress totals now derive from the exact artifact manifest, with an independent
pinned-footprint regression. Its pre-DeepStack 20-file model-focused selection passed **341/341 on
PR1 and 366/366 on PR2**, including the two new cached-decoder upgrade regressions. They verify
actionable refusal before worker creation and decoder-only replacement with retained weight
entries and exact final progress; unchanged weight bodies use explicit bounded fixtures,
while the replacement uses the real build-transformed graph bytes and digest. The earlier
eleven-file offline helper selections passed 273/273 and 331/331, not advisory or hosted-CI acceptance.
These counts do not validate the subsequent DeepStack changes. The September 8 responsive APK
does **not** contain either new graph transform. No APK was
rebuilt for it in this turn; neither the old APK nor these isolated checks qualifies the correction.

Bounded public-reference inspection located the missing 18 BF16 DeepStack tensors in a contiguous
151,080,960-byte range of the immutable original model, using only its 76,240-byte metadata header.
The alternate export's text graph also lacks DeepStack inputs and is not a replacement. A desktop
Chrome probe from an isolated simulated `http://tauri.localhost` origin read an exact eight-byte
HTTP 206 response and its CORS-exposed Content-Range. This proves that bounded browser transport
case, not the real APK, a full shard download, model accuracy or phone memory safety. Receipts:
`output/qwen-header-metadata-20260909-W89GS6/result.json` and
`output/playwright/qwen-range-browser-20260909-mWlwfD/result.json`.

The subsequently approved fixed-range capture downloaded exactly 151,080,960 bytes, retained
the header and per-tensor provenance, and left existing model caches untouched. Its SHA-256 is
`fecb4139b02964dea60cc588fdf3020796cb56280eb89626f2695617f72643d3` (newly captured, not an
independent upstream subset pin). Read-only lossless BF16-to-FP32 expansion produced the expected
302,161,920-byte digest `f331bfc4a32c5dcda5a3589283acd90672f8f903cda0d8f425f8aaaf0b148168`
without writing a second shard. All 18 source tensors were finite. These supplied the
following source integration, not a deployed DeepStack fix or image acceptance. Receipts:
`output/qwen-deepstack-bf16-fixed-20260909-QkCaBK/summary.json` and `tensor-identities.json`.

Current DeepStack source integration pins decoder **5,086,571 bytes** /
`dee3961fa1fe66c37f3f716d44a8daf571e12a4c5c6ce7884f99fe31454e83e8` and vision
**395,100 bytes** / `0b494b36663cc3ce66a34b33fb03e7f722c2957d10db29d55fe63854e7d358be`.
It adds the three learned vision mergers and decoder residual injections, strictly
verified range-to-FP32 weight transport, and per-prompt feature alignment in the
staged WebGPU sessions. Existing source graphs and weight shards remain unchanged;
the additional converted shard raises the manifest-derived installed footprint to
**1,836,700,049 bytes**. Exact source-range and converted-weight provenance is in
`frontend/app/model-asset-notices/MODEL_MODIFICATIONS.md`.

The existing ONNX parser and Noble hash roots now include these new consumers as
evidence, with explicit model-CI trigger witnesses and no added dependency roots.
At that checkpoint the frozen source review covered 38 files and the same 18 roots in each PR;
those snapshots retain the earlier review history. The checkpoint's 24-file model-focused
Vitest selection passed **414/414 on PR1 and 420/420 on PR2**. Earlier totals above
remain historical and must not be added to these overlapping selections.
The eleven offline helper files plus model-CI coverage and asset-notice checks
passed **311/311 on PR1 and 369/369 on PR2**, with zero failures/skips. PR2's
44-file app/OCR review changed only for model graph delivery in the shared Vite
and Rollup files; the other 42 files match its prior frozen snapshot. These
source/fixture checks send no advisory queries and are not hosted-CI acceptance.

A real desktop WebGPU run used the exact shipped JSPI runtime on a non-fallback
NVIDIA Ampere adapter, verified the actual ORT device identity, and disabled CPU
fallback for every session. All three cases passed: post-shuffle vision merger,
zero-feature decoder baseline, and nonzero features across three residual carries.
These use the actual emitted operator nodes with tiny synthetic dimensions and
weights, not full-model inference. Receipt:
`output/playwright/qwen-deepstack-desktop-20260909-jspi-XyZaa0/result.json`.
The separate Asyncify run is supporting evidence, not the shipped runtime.

The subsequent actual production-worker desktop run completed three requests in
the same worker without GPU device loss. Both single-date runs returned the correct
12,900 EGP and date, but fenced JSON violated the strict raw contract. The range
image returned **191215.0 instead of 1912.15**, an incorrect completed-payment kind,
and a guessed ISO currency instead of the printed symbol. Correct range dates do
not qualify that result. Full-model accuracy **failed**; this runtime completion
also does not prove every operator's GPU placement. Receipt:
`output/playwright/qwen-production-full-model-20260909-uaYIgE/result.json`.

Separate same-image diagnostics copied `$1,912.15` correctly in plain transcription
and monetary-copy prompts, while the original prompt and a string-amount variant
still lost its punctuation. This demonstrates prompt-dependent output, not an
implemented fix or a qualified replacement prompt. Receipt:
`output/playwright/qwen-production-full-model-20260909-jxq7Oi/result.json`.
The consuming app's 111 focused tests and 18 actual-PR2-host recorded replays pass,
including qualification rejection despite a schema-ready card/confirmation projection;
the wrong amount and kind stay visible, never heuristically repaired. A passing
negative replay is not successful model extraction.

Four further diagnostic candidates were rejected, including their repeated runs:

- A compact prompt copied the range amount/symbol and dates but omitted its required
  transaction kind; the single-date image gained an incorrect note and omitted the
  required empty ending-date field. All five same-worker requests completed:
  `output/playwright/qwen-production-full-model-20260909-J9JVqq/result.json`.
- A test-only selected-frame-fill worker corrected the range amount but retained
  the wrong kind and guessed currency; single-date output remained fenced. All four
  requests completed:
  `output/playwright/qwen-production-full-model-20260909-s90qbN/result.json`.
- Adding a system role to that diagnostic worker made the single-date transaction
  kind wrong and removed the range ending date while still guessing its currency.
  All four requests completed:
  `output/playwright/qwen-production-full-model-20260909-1SHFDi/result.json`.
- Native Qwen resize geometry corrected the range amount but kept the wrong kind
  and guessed currency; it also changed the single-date image's heading. All four
  requests completed on hardware WebGPU:
  `output/playwright/qwen-production-full-model-20260909-oWe8YY/result.json`.

Stable runtime and individual correct fields do not qualify any of these candidates.
None was adopted at that checkpoint; the production worker and app prompt were unchanged.

A separate six-request production-worker diagnostic correctly classified both
images when asked a short payment-status question or a kind-only question, while
the full extraction baselines retained the range errors. This narrows the
instruction-following failure; it does not qualify a partial-field response or
implement a multi-pass fallback. Receipt:
`output/playwright/qwen-production-full-model-20260909-4sw6Lb/result.json`.

A field-order-only diagnostic then placed classification and currency before the
other four unchanged field definitions. With the production letterboxed image,
classification became correct in both repeats but the range amount still lost
its decimal point. Receipt:
`output/playwright/qwen-production-full-model-20260909-lqBHHs/result.json`.
Combining that ordering with the selected-frame-fill diagnostic produced the
correct amount, kind, printed dates and heading for both images and their repeats.
Receipt: `output/playwright/qwen-production-full-model-20260909-GJVbQe/result.json`
(SHA-256 `f292b08f4a539968562848842757a3fbb9c24f853611304bde760c722bbd7d42`).
These are diagnostic-worker results, not adopted preprocessing or phone acceptance.
The range response's USD is consistent with the consuming app's user-approved
symbol mapping, but violates that historical prompt's literal-copy-only instruction.
The single-date response is fenced JSON, which the host parser supports; raw-format
conformance and actual card data accuracy must be reported separately. Neither
fact repairs or excuses the earlier incorrect amount or transaction kind.
All six combined requests completed on hardware WebGPU without unexpected device
loss. Its completed temporary browser profile was removed after closure, reclaiming
1,868,304,384 bytes while retaining raw results and the original model files.

The unwired native-target experiment was subsequently retired from both release
source slices. One byte-identical helper/spec pair is preserved under
`<project-temp-root>/admin/qwen-native-image-experiment-20260909/`. Its 27 passing
tests, 529 geometry comparisons and three actual-processor RGB cases are historical
experimental evidence, not active release-test counts or phone qualification.
The shipped layout/context/worker-build suites now pass 71 tests in each PR after
retirement. Both latest diagnostic browser profiles were removed after verified
closure; reusable model files and raw result reports remain.

At that diagnostic checkpoint no OpenChat production behavior changed and no new
APK was built or installed. Those historical diagnostics alone did not qualify a
model, deployment, advisory acceptance or release readiness.

#### Subsequent production-worker desktop qualification

The adopted generic Qwen layout keeps the same selected frame and 640-raw-patch
ceiling. It fills only near-aligned frames whose per-axis padding is below 32
pixels and whose additional aspect enlargement is at most 9/8; other shapes retain
letterboxing. This affects model input only, not displayed chat images. Gemma's
preprocessing is unchanged. Geometry tests include 484 dimension pairs, near-bound
negative cases and extreme panoramas.

A fresh, unmodified production-worker build then completed both reference images
twice using the consuming app's actual revised extraction prompt. All four raw
responses had correct source fields and valid unfenced JSON. Actual hardware
WebGPU was observed, with no unexpected device loss and successful worker disposal.
The exact outputs separately passed the real host/app normalization, editable-card
and confirmation-value replay; nothing was posted. This is desktop worker plus
recorded-output app-path evidence, not an actual UI or phone proposal.

- Build receipt: `tmp/qwen-production-worker-only-20260909-SudX1I/build-summary.json`,
  SHA-256 `c6edf739464782f6b0da28de2db1b03d563818a25e9d38f21c0c165165ff6e8d`.
- Production worker: 902,257 bytes,
  SHA-256 `5c86880afd9105ca2f5fd26427420a702ff6719e46397e4f7fb08909c5ca38ea`.
- Model result: `output/playwright/qwen-production-full-model-20260909-heUSm0/result.json`,
  SHA-256 `331552d740b208315eb575277419a3199578a0ee8b02453ed47b14c99ffa1e87`.
- App-path result: the sibling `card-replay-current-policy.json`, all four qualified.
  Its symbol-mapping acceptance is an explicit app-owned policy, not a host-side
  correction or a waiver of the earlier wrong amount/classification.
- App prompt SHA-256:
  `a921746fc62f9e7fe3d8bc4d89f766f92fa57530e832832b0fdd5b97454fcb82`.

The temporary 1.86 GB diagnostic profile was removed after verified closure,
preserving source model files and reports. The corresponding September 9 local APK
subsequently passed emulator cold-start and installed-asset checks as recorded
below; repeated supported-phone behavior remains unverified. Later Gemma and Qwen
shared-prompt testing found broader source-accuracy failures, as summarized above.
No APK model-inference, all-operators-GPU
proof or complete release readiness is inferred from these desktop requests.

Artifact boundary: the older production bundles/OTA archives and September 6 local-test APK
predate the September 7 startup/authentication fixes. The combined reviewed September 7 APK
was subsequently built from PR2 `e3d2cb91a426c67c6bcef0c5f664999e1676fb16`, with passing emulator
startup and all 26 installed-asset checks. It is the retained physical-phone local-test APK,
not a model-only PR1 release artifact or physical-GPU acceptance. The later PR2 change to
`d7b94d8649951a5b7d4f46b7d216d41734dd4cf7` touches only six documentation/security-policy/test
paths, so that head change alone does not require an APK rebuild or change its build attribution.
The September 8 runtime-fix APK was subsequently built and binary-verified from source-bound
PR2 inputs. Emulator install-over succeeded; its cold-start ADB probe failed, while later
read-only UI/26-asset inspection passed without qualifying startup or inference. Its version is
`2.0.0-local-webgpu-responsive-20260908`; see the paired readiness record for exact receipts.
Physical-phone acceptance remains pending, and that APK predates the September 9 mRoPE
and DeepStack corrections above. Do not attribute later source corrections to September 7's artifact.

The current local-test handoff is `OpenChat-local-test-qwen-20260909.apk`, version
`2.0.0-local-webgpu-qwen-20260909`, SHA-256
`5f2610f2fa27830e15c21b47b5b08b250b324f2989e032750fa3c0003efabe31`.
Its source-bound build matched the exact worker bytes used for the two-image desktop
checkpoint, not a broadly qualified image model. Subsequent emulator
cold-start passed (first ready 4,293.3406 ms), as did all 26 installed-asset checks,
local origin and OTA-none policy. See the paired readiness record's September 9
section for exact build, smoke and terminal emulator receipts. This is not APK GPU
inference, retained-account/model-state or physical-phone qualification. Later
removal of the unused native helper/spec leaves the worker input graph and retained
APK bytes unchanged; the build receipt remains the historical source identity.

The refreshed source and dependency lock have not replaced the existing PR head. A later
physical-phone preflight matched both cached base-model inventories, selected Qwen through the
actual UI while preserving the other model, and observed one user-initiated all-WebGPU image
completion on the retained APK. That run exposed a lengthy pre-attachment verification stall;
it does not qualify the new runtime fixes, repeated inference or optional audio. USB later
reconnected and a fresh app-authored card passed rendered-content/layout checks on the same
old APK; that repeat did not recapture raw model output or model identity. September 9's
APK cold-start is now qualified, but its model inference is not. Final-head hosted checks,
repeated supported-phone inference/cache reuse, optional voice if enabled, disabled/unavailable
behavior and retained account/passkey/model state remain outstanding. The paired app slice's
runtime integration gate remains its selected 54 tests, not a 465-test core/full-suite requirement.

PR1's own four target/feature metadata profiles and selected Rust closure were extracted and
validated offline with **183 unchanged dependency inputs**; the 190-input observation belongs
to PR2. The combined eight-profile receipt
`<project-temp-root>/tmp/rust-advisory-offline-plans-e8cUoE/summary.json` plans 474 PR1 registry
queries (473 for PR2), with seven Git identities separately unqueried per scope. **No queries
were sent**. `rootCompletenessVerified:false` retains the bounded-coverage limitation; no concrete
additional missing Rust root was identified. It does not expand this task into optional development
tools, unchanged core fixture code or a general native C audit. Feature-union and unqueried-source
limitations remain explicit, without claiming current feature security clearance.

Remaining dependency review is limited to model-related changes and their introduced or changed
dependencies. Historical whole-lockfile findings and expired broader baselines are not waived,
but do not authorize new OpenChat core audits or make unrelated core remediation a scoped gate.
No fresh advisory scan or feature security clearance is claimed. Validate the final proposed
workflow scope before pushing: implicit installation audits are disabled, and the legacy
whole-lockfile audit/SBOM/default entry points now fail closed before side effects. This is an
interim safety barrier, not a successful security gate. The separate offline feature test step
is already wired; replacement of the remaining guarded commands and authorized advisory evidence
remain incomplete. No advisory network request is authorized: the egress approval gate rejected
the scoped request and it awaits explicit user approval. No whole lockfile was uploaded or
fallback attempted. The user-approved RAM socket plan has now executed the paired app slice's
selected gate: the first run returned 26 passed / 28 failed / one ignored, with 411 filtered.
Stale test-only directory/card/ingress fixtures were corrected; production WASMs were unchanged
and a freshly source-bound harness relink passed. The second 54-test run returned 52 passed /
2 failed / one ignored, with 411 filtered. The public-key line-ending and cancellation test
fixtures were then corrected; a final source-bound relink/run passed **54/0/1 ignored** in
186.35 seconds, with all production/WASM inputs unchanged. Receipt:
`tmp/pr2-selected-integration-7380b7fc33de4badb35cd6cebe905f0f/summary.json`.
This is local Windows-harness/Ubuntu-PocketIC evidence, not hosted Linux CI. Completed compiler
objects and Cargo fingerprints were later retired during approved temp cleanup, preserving
the executable, WASMs and receipts; future builds must regenerate the cold cache.
The earlier disk preflight failure is historical. Runtime/test-source inventory pins
were refreshed and the targeted guards pass 8/8, without an advisory query or security-clearance
claim. Explicit license metadata checks remain locked and offline. Validate the
stack against upstream, complete its hosted and real-device acceptance, and refresh the PR
evidence before declaring it ready. The requested APK is for local testing only; publisher
signing, production distribution and OTA decisions are separate publisher guidance, not local
test prerequisites or a request for publisher credentials.

See [local upstream reconciliation](../local-model-upstream-reconciliation.md) for the
historical merge checks and their limits. No production activation is requested.
