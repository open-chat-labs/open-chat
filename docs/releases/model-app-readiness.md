# Model and app integration: PR and release readiness

Assessment: 2026-09-07. **Prepared for continued draft review; not ready for a production release.**
No PR, release, PR branch base, production switch, signing key, or deployed service was changed
by this preparation. The locally reconciled stack has not been pushed or published.

## Current delivery scope: source preparation and local-test APK

The developer requested a locally testable APK, **not the publisher's signed release APK**.
Use the existing configured local signing identity, local backend/origin and OTA-disabled
all-WebGPU build. Do not require a new publishing keystore, distribution-service credentials
or a publishing versionCode to produce that local test artifact. The publishing-only checklist
below remains guidance for the eventual publisher; it is not a prerequisite for local testing.
Local APK acceptance still requires checking bundled assets, application/account identity,
startup and the model flows. Neither local signing nor successful unit tests proves production
deployment or physical-device GPU acceptance.

## Latest local upstream reconciliation

Local reconciliation was committed as PR1 `b461c4b7a3b59daa1d1a4aace002e1d3ffa55d57`
and PR2 `cdceb9d127a329b49a82795662fadba77ab2f18f`, tree
`1e3386eb094d12707953cb670c9a38520a663208`. PR2 includes that PR1 head through a reviewed
tree-preserving ancestry merge; both checkouts were clean afterward, with no unmerged index
entries. Neither published PR head has changed. The frontend/backend source validation below
was recorded before these commits and retains its original source-snapshot boundaries.
Subsequent declaration-only Candid and regression/CI follow-ups were validated before commit
as changes atop that PR2 head; their separate source-contract validation is recorded below.
The historical welcome APK predates the final worker-logging and mobile-theme fixes and
cannot represent the reconciled source. Its historical startup acceptance is summarized
below, separately from the newly built reviewed APK.
The September 6 APK and production bundles do not contain the later September 7
welcome-readiness and authentication-error-display fixes described here.
PR1's mixed-owner Git protection required an explicit developer-approved, per-command
trust exception for the exact PR1 checkout before owner-context Git inspection could resume.
That scoped exception is now approved; ownership, ACLs and global Git settings remain
unchanged. The exception permits inspection but does not itself resolve or verify the index.

| Local validation (scope described below)         | Result                                                         |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Full frontend Vitest                             | 190 files / 2,550 tests passed; none skipped                   |
| Svelte / agent TypeScript                        | Svelte: 0 errors / 562 warnings; agent `tsc`: passed           |
| Read-only ESLint                                 | 0 errors / 31 warnings                                         |
| Offline build/CI/security-helper regressions     | PR1: 104 / PR2: 340 after launcher CI routing repair          |
| Focused Candid source contracts                  | 38 passed; includes method-name sets for all 25 interfaces     |
| Full generated Rust/Candid parity                | 25 generated interfaces / 50 strict comparisons passed         |
| Full backend unit workspace                      | 957 passed / 0 failed / 1 existing ignored test                |
| Full backend strict Clippy                       | Passed, including integration-test compilation                 |
| Targeted user action-card tests                  | 12 passed                                                      |
| Native default-feature OTA tests / strict Clippy | 27 passed / passed                                             |
| Android component registration                   | 12 host tests, 7 SDK checks and Android 36 compilation passed  |

Windows native validation on PR2 `4f9acad2b26b61623836b7652831f2df78702716`
passed locked/offline `open-chat` checks with `inference` and `inference,store`.
Plugin library tests passed 27 default-feature tests and 41 inference-feature tests;
four fixture-dependent tests were ignored in the latter selection. All 279 recorded
native inputs and Cargo.lock were unchanged. Receipts:
`native-feature-runs/launch-0a709def843a40d0850ca5ff4d94d969/summary.json` and
`native-feature-runs/launch-f22a4fbf6640401c90f8a7a170442111/summary.json`.

After the CI-only commit `bdb5c00ff1c9c4c5ee2f805affed94f2f29b8750`, the exact
`inference::tests::text_inference_smoke -- --ignored --exact --nocapture` Cargo selection
also passed with `--locked --offline`: one test executed, none ignored, 44 filtered out.
The workflow's immutable TinyLlama fixture matched its 13,893,600-byte size and SHA-256
`a439d0bbdce924ff1a32f68b7b2dd7fa0b98687f7eb6e7e55206527b446362af`.
The same 279 native inputs and lock remained unchanged. This executed real Windows CPU
generation, but asserts only non-empty text; the output was repetitive and the runtime
warned that its context exceeded this tiny fixture's training context. It does not establish
answer quality, structured output, vision, Linux, phone WebGPU or app-card acceptance.
Receipt: `native-feature-runs/text-68a57f415c22446d9820ccca4b274f34/summary.json`.

The component fix registers actual app classes independently of the installed application ID.
It preserves notification payloads and supports the local identity profile without changing
the upstream namespace. Host tests do not prove Android runtime behavior or account retention.
The opt-in local identity profile has produced a binary-verified APK. Runtime acceptance
remains partial; physical-device inference and account/model retention are not established
by an install-over operation or host component tests.

Independent review also caught a recovery-screen chunk dependency: when the stale-worker
recovery chunk could not load, startup mounted nothing. The lightweight recovery component
is now eager while selected app layouts remain lazy; an actual-entry regression failed before
the fix and passes afterward. The optional Android credential-cache read now has one bounded
deadline across enumeration/open/read, aborts its owned readonly transaction on timeout, and
closes late connections. It never clears account data or substitutes cache hints for native
authentication. The full test/type/lint results above include both startup fixes and the
subsequent worker-logging and mobile-theme corrections.

The merged frozen install used Node 24.14.1 / npm 11.11.0, with lifecycle scripts and npm audit
disabled. CI remains pinned to Node 24.18.1. Fresh current-lock dependency review has not been
approved or completed; expired baselines and historical advisory evidence below are not waived.

### September 7 verification hardening

Both exact reconciliation commits were subsequently tested sequentially with
`node --test --test-concurrency=1 --test-reporter=spec 'scripts/*.test.mjs'`:
PR1 passed 94/94 and PR2 passed 296/296, with no failures, skips or cancellations and native
exit 0. HEAD, tree and clean status were unchanged afterward. Saved summary and individual
logs: `postcommit-node-helpers-20260907-8d38a451833749408c13f7c72e5b76a2/summary.json`.
This post-commit rerun covers Node helpers only, not frontend Vitest, dependency audits,
hosted CI or later Candid follow-ups.

Actual generated-interface comparison then exposed declaration drift: shared Candid omitted
the existing Rust `ActionCard` message variants and records, while user-index Candid omitted
the private-match capability redemption method and the optional action recipient scope.
The corrections change only those two Candid files, not runtime Rust implementations.
The recipient variant preserves the actual serde wire labels, `confirmer` and `app_authorized`.

The new offline source-contract suite passes 38 tests: complete message-variant sets,
selected record fields/types and renamed states, plus method-name sets discovered from all
25 actual API directories. Controls reject duplicates, unsupported export forms, misleading
comments and an in-memory recreation of the missing user-index method. The initial shared
schema regression failed before its repair. Frontend CI used an explicit helper list; a
separate red-to-green routing regression now requires this suite in its executable policy
step, including for Rust/Candid-only changes. These checks are bounded source readers, not
full Rust/Candid parsers or proof of method signature/mode equivalence.

The final follow-up run passes all 336 offline Node helpers with no failures, skips or
cancellations; focused tests, the aggregate and scoped formatting each exit 0. All 207
recorded inputs, including the 25 Candid/Rust-main pairs, retain their hashes; HEAD and
dirty status are unchanged during the run. Evidence:
`candid-contracts-all-apis-final-20260907-c8d69fd637234e51816036356c7a0852/summary.json`
and its focused, aggregate and formatting logs. This is pre-commit follow-up source
validation, not a post-commit 336-test claim.

The subsequent complete generated-interface rerun also passes: all 25 interfaces regenerated
and all 50 strict comparisons succeeded, in both directions, with native exit 0 and a terminal
monitored child. All 2,879 recorded source inputs and the Cargo lock were unchanged. This
accepts the recorded working declaration fixes atop `cdceb9d127a329b49a82795662fadba77ab2f18f`,
not that earlier commit alone. Evidence:
`backend-candid-parity-runs/launch-fce066b6cd434a5d81dd22583dec9c56/summary.json`
and `run-475e62309c1b4d729e248875e99ba0bf/completion.json` beneath that launch directory.
The fresh reviewed APK's separate startup/asset acceptance follows. Interface parity does
not establish integration execution, hosted CI, physical-device or authenticated app-flow acceptance.

### Reviewed local-test APK: September 7

`OpenChat-local-test-reviewed-20260907.apk` was built from clean PR2 commit
`e3d2cb91a426c67c6bcef0c5f664999e1676fb16`, with frontend version
`2.0.0-local-webgpu-reviewed-20260907`, the configured local signing identity,
all-WebGPU support and OTA strategy `none`. The 78,596,874-byte artifact has SHA-256
`2c1db086278e5e8308a5bb925d3de751464c63961caedcbaa01fffe81c31a55e`.
The monitored build exited 0; all 5,934 recorded regular source files, four unfollowed Git-link
identities and 11 builder/configuration/lock inputs were unchanged. Evidence:
`apk-reviewed-source-identity-c0c8876178b449aa8289fd4ddb6628d0/summary.json` and
`local-apk-welcome-runs/run-76e65b7fd74c4b5ba45a64531ff9a7a2/completion.json`.

The APK was installed over the existing app on `emulator-5554` without uninstalling or
clearing app data. Onboarding was first observed ready
3.37 seconds after the cold launch and remained ready through the asset checks. All 26
installed runtime assets matched their distribution hashes; the pinned ORT module imported,
its WASM compiled and the actual worker acknowledged disposal. The packaged origin was
`http://tauri.localhost`, with the expected version and OTA-none policy. The screenshot
showed the expected onboarding controls. Evidence:
`apk-welcome-smoke-485363da6bd74e7b9df0fa348ce23657/summary.json`, `smoke.json` and
`onboarding.png`. This does not prove retained authentication/model caches, wallet sign-in,
physical-device GPU inference or complete app-authored card flows; no model inference ran.

The build retains Sass, SDK and Gradle warnings. Its Porto/Tempo unresolved-dependency
warnings were traced to unused connector code: a read-only parse of all 186 top-level emitted
JavaScript files found no static or literal dynamic bare imports. That review is not wallet
authentication acceptance or a new automated bundle regression. No release was published.

### Other verification hardening

The store-AAB verifier now checks the base-manifest package, version name and version code
independently of its existing signature checks. Its standalone bundletool 1.18.1 is pinned
to 32,505,571 bytes and SHA-256
`675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c` before execution.
That hash is locally measured official-download evidence, not an upstream-published checksum.
The offline release selection passes 103 tests
(`node --test scripts/android_release_policy.test.mjs scripts/android_release_checks.test.mjs scripts/release_preflight.test.mjs`;
locally observed terminal output). Separately, the actual pinned tool passes 11 synthetic
aapt2-compiled manifest cases, including wrong/missing/padded identity attributes,
namespace/duplicate lookalikes, malformed bundles and a modified tool. Evidence:
`aab-manifest-real-tool-tfZsvO/summary.json`. These fixtures do not accept a production
bundle, publisher signing, installation or upload.

Both frontend entries now render anonymous-home onboarding without waiting for chat
registry discovery, while leaving authenticated, public-route and chat/card readiness
requirements intact. Query-driven Home navigation retains ownership of its modal state.
Mounted regressions exercise both actual entry components, including late readiness and
authentication buttons that stop event propagation; capture-phase activity tracking preserves
an in-progress v1 form. A fresh independent PR1 run passes all 123 files / 1,488 tests,
Svelte with 0 errors / 558 warnings, agent TypeScript, read-only ESLint with 0 errors /
30 warnings and all 94 Node helper tests; no tests were skipped. Its 37 dirty files matched
the independent review inventory before execution. All 46 recorded source/lock/configuration
inputs and the dirty path/status set were unchanged afterward. This refresh confirms the
same counts, not an additional test population. Evidence:
`pr1-frontend-validation-20260907-auth-display/summary.json` with its stage logs and
`vitest-results.json`; before/after snapshot SHA-256 is
`97da970c1a964d64b693b99658c006aacdacc7a03a7c4587c0132a8d8e7acb69`.

PR2's earlier
188-file / 2,535-test startup rerun included the final test-only loader mocks. Nineteen selected
startup/authentication/configuration source hashes were unchanged during those runs. That
frontend count is superseded by the post-review 190-file / 2,550-test run below.

Post-review regression tests caught two more merge interactions. The worker now preserves
the shared logger's primary-error and expected-error-filtering contract while passing only a
new bounded, redacted error to telemetry. It does not log request payloads, original messages,
stacks, causes or arbitrary error names, and correlated errors returned to callers are unchanged.
Six of seven real-worker/shared-logger cases failed before the correction; all seven then
passed within a 33-test worker/error selection. No live telemetry was used.

Mobile AI status and spinner surfaces also retained theme variables removed upstream.
Only generic theme-token references were corrected, including the companion suggestion chip;
inference, routing and app interpretation are unchanged. Eight dark/light regressions failed
before the fix and pass afterward: they compile the actual component styles and mount the
real shared spinner with prop values read from its callers. Together with existing composer,
card-layout and selected-message flow tests, the focused selection passes 29 tests. This is
not a full chat mount or a device visual/inference acceptance run. PR1's corresponding
components have no affected token references, and the PR2-only chip was not copied into PR1.

The final sequential PR2 validation passes 190 frontend files / 2,550 tests, Svelte with
0 errors / 562 warnings, agent TypeScript and read-only ESLint with 0 errors / 31 warnings.
Targeted formatting also passes. All 62 recorded source/lock inputs retained their hashes
through the run; this is a bounded working-tree snapshot, not a commit-wide artifact attestation.
Evidence: `pr2-frontend-validation-20260907-cf114059659944cf8bd4db45b0016619/summary.json`
with its `vitest-results.json` and stage logs; `pr2-resolution-review-SKfjgo/worker-logging-red-behavior.json`
and `worker-logging-green.json`; and `pr2-mobile-ai-theme-red-20260907.log` /
`pr2-mobile-ai-theme-green-20260907.log`. These fixes postdate the welcome APK below.

Native onboarding error rendering now maps known raw authentication codes to existing
translations and uses the generic translation for legacy/unknown codes. Authentication
handlers and recovery routing are unchanged. Regression tests execute the actual template's
display expression and mount the real translation component with English and Arabic
catalogs; they do not mount the complete authentication modal or exercise device providers.
These source tests alone do not establish APK startup or sign-in acceptance. Separate
September 7 installed-APK startup evidence is recorded below; sign-in remains unverified.

Both model workflows now have a separate Android component-contract job with nine
byte-size/SHA-256-pinned Kotlin/JUnit tool artifacts. The actual cached artifacts were
checked against that manifest, then used separately on both trees for 12 host tests,
7 real-SDK constant checks and production-source compilation against Android 36.
The resolver/CI-coverage subset passes 40 tests per tree. All six native Cargo test/check
commands retain their platform, feature and real-fixture selections and now require
`--locked`; a regression rejects either an unlocked or unaccounted-for native command.
None of these host checks proves Android authentication, cache retention or GPU inference.

The backend PR change-detection job now explicitly requests only `contents: read` and
`pull-requests: read`, as required by its PR-files filter. The permission regression failed
before the fix. The rollout wiring validator also previously accepted numeric prefixes:
expected app ID 1 matched 12, and signature version 4 matched 40. It now validates the
structured output of `dfx --query --output json`, including exact IDs, relay/route,
authorized depositor and signing-key metadata. Its 48 real-shell regressions run in the
hosted frontend policy step; separate coverage tests reject a suite mentioned only in a
comment or another step. No live canister response or independently pinned consumer key
was verified by those fixtures. Official DFX JSON mappings and repository types were
reviewed, but exact pinned-version response serialization was not dynamically reproduced.

The actual unchanged Candid syntax script passed all 25 interfaces with exact CI `didc`
0.3.2 in explicit Ubuntu, after an earlier cached-0.4.0 run. The script and all 25 inputs
retained their hashes. The legacy official release provides no publisher checksum;
the download's official release URL/size, executable version and local SHA-256 are recorded,
not described as independently signed provenance. This is exact-tool local syntax evidence,
not hosted CI or Rust/Candid parity. The parity checker has real-shell failure-propagation
and temporary-file-cleanup tests. At that earlier stage, its actual generated-interface
comparison was outstanding; the completed full rerun is recorded above. Matching Rust 1.95 Linux
offline metadata resolution stops before compilation because locked `h2` 0.4.16 is absent
from that cache. The earlier full Windows backend gate stopped in OpenSSL configuration
because Cygwin Perl does not satisfy the MSVC target. The project-local native Perl retry
successfully compiled OpenSSL's MSVC libraries and progressed through notification
dependencies. That exact workspace run was then terminated for disk safety before any
unit test ran; it is an aborted gate, not a passing result or a source-test failure.
That first disk-aborted run changed no profile, package exclusion or lockfile.
A subsequent exact-scope retry exposed a real reconciliation compile error: ActionInbox
still called the removed `utils::git` API. It now uses the existing workspace-local
`git_commit_id` crate, as the upstream canisters do. The manifest and lock change add
only that local dependency edge; no external package version, source or checksum changes.
Locked offline metadata, workspace formatting and the helper regressions pass. The next
monitored retry compiled ActionInbox successfully but again stopped at the disk-safety
threshold before any unit test ran. This remains an aborted full gate, not a pass.
The current Cargo lock SHA-256 is
`dd165eddd49d39daebdbbe80aa78199845b8cb3d3ca42d4ce89d131e3b97116b`.
Generated-artifact compression preserves file contents; no backend profile or package
exclusion has been relaxed to make the gate fit.

The subsequent full-scope retry reached a verifier test-compilation error: a fixture
converted `UserId` back into `Principal` through a removed upstream API. The fixture now
supplies the identical principal directly, with no production encoding change. All five
`ai_app_verifier_canister` tests pass, including the fixed canonical commitment hash and
recipient-scope compatibility assertions. That full workspace attempt failed before tests;
the focused five-test result did not replace it. Evidence:
`run-7dfa9edc63cc48fe9df287a10668f5c0/completion.json` and
`pr2-verifier-fixture-green-20260907.log`.

A later exact-scope retry exposed a stale source assertion for the upstream typed C2C
error accessor. The test now accepts formatting changes but retains an exact redacted-log
field allowlist. After that test correction, the complete backend unit command passed:
`cargo test --locked --offline --workspace --exclude integration_tests --exclude open-chat --exclude tauri-plugin-oc`.
The result is 957 passed, 0 failed and 1 existing ignored `print_interop_vector` test; the
monitored process exited 0 and the Cargo lock hash above was unchanged. This supersedes
the earlier aborted/failed unit attempts without relaxing their package scope or profile.
Evidence: `backend-unit-runs/run-f4b0d6a9c33747b4b6ee2e23b49858f7/completion.json` and
its `stdout.log` / `stderr.log`. Full backend unit success does not establish integration-test,
Candid parity, hosted CI, backend rollout or device acceptance; those remain separate gates.

Full backend strict Clippy now also passes the exact local command
`cargo clippy --locked --offline --keep-going --workspace --exclude open-chat --exclude tauri-plugin-oc --tests -- -D warnings`.
This includes compilation of `integration_tests` targets, not their execution. The monitored
run exited 0 with warnings treated as errors; the recorded manifest, lock, backend-workflow and
monitor hashes were unchanged. Minimum observed free space was 8,358,588,416 bytes, with
the existing disk thresholds unchanged. Evidence:
`backend-clippy-runs/launch-1b806ddff30e473fae987a5241dda4bb/run-fbbac4b6573940f5a52a03b5fde0f67e/completion.json`,
its logs and the launch directory's `preflight.json` / `source-after.json`.
Only process-local native-tooling setup was corrected: the MSVC environment and canonical
`Path` key restore nested compiler lookup. A controlled native probe reproduced the uppercase
`PATH` failure and `Path` success (`clippy-path-casing-probe-20260907-7495c9d2/controls.json`
and `wrapper-regression.json`). No source gate, package scope, profile or warning policy was
weakened. Full generated-interface Candid parity subsequently passed as recorded above;
hosted CI, integration execution, refreshed APK and physical-device acceptance remain separate gates.

The backend integration wrapper now also requires `cargo test --locked`, preserving its
existing package, filter, thread-count and failure behavior. Its source-command regression
failed before the change and passes afterward in the hosted policy suite. This is a
reproducibility check, not an actual integration run: the wrapper's download/setup and
canister lifecycle tests have not been accepted from these fixtures.

Local evidence: `openchat-pr2-offline-policy-final-20260907.log`,
`openchat-pr1-offline-policy-current-20260907.log`,
`pr1-real-cached-contracts-20260907-005553.log`,
`pr2-real-cached-contracts-20260907-005553.log`,
`openchat-pr2-ubuntu-candid-syntax-20260907.log` and
`openchat-pr2-ubuntu-offline-metadata-20260907.log`. The exact-tool syntax rerun is
`pr2-didc-0.3.2-syntax-20260907-015942-021.log`; the aborted Windows run is
`openchat-pr2-native-perl-backend-workspace-unit-20260907.log`.

### Latest tested local APK: September 7 welcome; final-source rebuild required

**This APK predates the final worker-logging and mobile-theme fixes above.** Its three
cold-start passes remain valid for this exact artifact, but it is not the final current-source
APK. Rebuild and repeat bundled-asset and startup verification before handing it off as such.

The monitored local build completed with exit 0 using the unchanged locked dependencies,
the configured existing local signer, application ID `com.oc.app`, version code `1000`
and upstream code namespace `com.oclabs.openchat`. Binary checks verified the signer,
manifest/DEX component classes, FileProvider authority and embedded ARM64 native library.
The 78,596,874-byte handoff APK has SHA-256
`de78547f9f7dd3612a5178423547561814544401d0feacf4f5a79d49750f5659`.
It contains frontend version `2.0.0-local-webgpu-welcome-20260907` with OTA strategy `none`.
At build time, this artifact used the then-uncommitted merge and follow-up changes, not a
published PR head or either merge parent alone. It is not current-source acceptance.
The September 6 rollback APK is preserved.

An install-over on the existing emulator package succeeded without uninstalling or clearing
app data. Three separately timed cold launches then passed the strict 30-second startup
gate. The v2 onboarding controls were first observed ready at 3.462, 2.255 and 2.473 seconds
from the respective host launch timestamps, and remained ready for at least 300 ms and
through the final observation. The latter two launches did not reinstall the APK. Every
run verified all 26 installed asset hashes/sizes, exact frontend version, disabled OTA,
ORT factory import, WASM compilation and a disposable worker roundtrip. The rendered
welcome screenshot was visually checked. No navigation/reload or late existing-state
inspection was substituted for cold-start acceptance.

These results establish this artifact's local packaging and anonymous welcome startup only.
They do not establish signed-in account/model retention, passkey provider behavior,
authenticated app-card flows or physical-device GPU inference. No model was downloaded
or executed by these smoke tests, and prior emulator DNS/GPU findings are historical,
not a fresh capability check of this APK.

The build launcher required process-local host corrections: canonical Windows `Path`
key casing, the already-cached repository-pinned DFX version, and excluding only its WSL
executable variable from Git Bash environment-path conversion. Controlled probes reproduced
the launcher failures before correction. No system default, public-key/version guard,
dependency lock or application feature was relaxed to obtain the build.

Local evidence: build run `run-d7ca54f6c78c4b96a2eadaa4afe58a20/completion.json`,
`apk-welcome-smoke-0a23c1ed0e07455b84b9b91ef5906bc8/summary.json` and `smoke.json`,
and repeated cold-start reports under `apk-welcome-cold-repeat-5f1b1bb109b44f24ae31d9d1f40e6be5`
and `apk-welcome-cold-repeat-d780748aa06c4f90bf5187aad5a3894a`.

### Historical September 6 local-test APK: merged source

**Artifact predates the latest source fixes.** Its identity/assets remain recorded evidence,
but it must be rebuilt and retested before claiming the September 7 behavior on Android.

The configured local builder completed with exit 0 and produced a 78,596,874-byte APK,
SHA-256 `c63fead2d577892bb4ff4e71da373c33f54cc39510d9e04eb9873e8a74f9ac56`.
Binary verification passed for installed application ID `com.oc.app`, version code `1000`,
and the existing configured local certificate. The code namespace remains
`com.oclabs.openchat`; the local profile does not rename upstream classes or change the
publisher's identity. The frontend version is `2.0.0-local-webgpu-merged-20260906`, with
OTA policy `none`. Source attribution is the dirty `6be70333` + `2a95a68` merge above,
not a published PR head or either parent commit alone.

This was the local artifact at that time, replacing the earlier `551265bbe` APK as the test
candidate. Its identity report was captured before installation. The subsequent install-over
on the existing emulator package succeeded without uninstalling or clearing app data, and
the activity launch reported `Status: ok` in 11,789 ms. Neither result proves account reuse,
model-cache retention or UI readiness. The initial strict 30-second readiness probe failed
at its attach-stage body snapshot (4,000 ms timeout, 24,972 ms elapsed from launch); its 26
installed-asset checks were **not run**. Mobile startup is not accepted from this result;
the corrected probe subsequently gave UI observation the full remaining 30-second budget
and **also failed**. Its activity launch took 6,804 ms; at 29,933 ms from launch there was
no visible main UI, no button and no error pane. Observation timed out at 30,012 ms, and
the inspected screenshot still showed the spinner. This retry did not run asset checks.

A separate read-only `inspect-existing` run passed all 26 installed-asset hash checks,
confirmed the exact new frontend version and OTA policy, imported the ORT factory, compiled
its WASM and disposed its disposable worker. The expected v2 welcome screen was also
observed and visually checked. That report deliberately records `inspectionPassed:true`
but `passed:false` and `coldStartAccepted:false`: inspecting an already-running app cannot
accept cold startup. An earlier post-start observation showed eventual welcome rendering
at 194,417 ms of navigation time; eventual rendering does not repair the failed deadline.

That APK's diagnostics independently showed that its configured private backend failed with
`net::ERR_NAME_NOT_RESOLVED`; no network configuration was changed. This proves backend
unreachability in the emulator, not that DNS alone explains the startup delay. Its WebView
151.0.7922.199 exposes `navigator.gpu`, but both default and high-performance adapter requests
return null. No model was loaded or inference performed. No fatal native/Java failure was
observed in the inspected logs, which did contain emulator graphics warnings. The current
emulator at that time provided neither startup acceptance nor all-WebGPU inference evidence;
physical-phone, account/model-retention and authenticated app-card checks remain outstanding.

Two build-environment repairs preceded the successful build. A shared Tauri package cache
from the prior namespace omitted the generated activity and ProGuard output. Only that
scoped package cache was refreshed (29.8 MiB); the vendor generator then emitted both files,
without copying generated app code from another checkout or namespace. The previous APK
and native library were preserved. Process-only `kotlin.incremental=false` avoided the
cross-drive incremental-cache exception; no global compiler default was changed.

Local evidence is recorded in `openchat-local-apk-merged-identity-20260906.json`,
`openchat-local-apk-upstream-build-generated-cache-fixed-20260906.log`, and
`openchat-local-apk-merged-readiness-20260906.json`. The final strict retry is
`openchat-local-apk-merged-cold-retry1-20260906.json`; separate inspection, backend and GPU
records are `openchat-local-apk-merged-existing-inspection-20260906.json`,
`openchat-local-apk-merged-backend-probe-20260906.json` and
`openchat-local-apk-merged-webgpu-capability-20260906.log`. Binary checks, install/launch,
strict startup, existing-state asset inspection, physical GPU inference and authenticated
app-card flows remain separate results. This artifact is not published or publisher-signed;
publisher-only signing, version and upload requirements do not block the requested local test.
Security-policy failures and
the outstanding fresh-audit consent are unchanged.

### Historical post-startup-fix production bundles

Both production frontend variants were rebuilt after the two startup fixes above, using the
same dirty merged working tree and existing frozen dependencies. Fourteen recorded source
fingerprints, including both startup-fix files, were unchanged during each build and identical
between builds. The results include uncommitted merge bytes, not just either parent commit.
The frontend lock SHA-256 remained
`8315c6237eac3758e25e6c3428e11c917fbfb1da56ecab57f8fd93eb59f92507`.

| Final frontend configuration        | Build result     | Preserved files / bytes | Model worker and ORT JSPI |
| ----------------------------------- | ---------------- | ----------------------- | ------------------------- |
| Default production                  | Exit 0; 2m 35.7s | 933 / 118,043,376       | Absent as expected        |
| Explicit immutable WebGPU candidate | Exit 0; 2m 35.3s | 949 / 169,102,826       | Present and verified      |

The ordinary worker (1,337,869 bytes), video worker (625,789 bytes), and candidate-only model
worker (894,466 bytes) match their freshly compiled outputs exactly. Both default ZIPs contain
574 files and both candidate ZIPs contain 596; all four preserve their expected worker bytes.
The [distribution verifier](../../scripts/verify_webgpu_distribution.mjs) passed all 26 assets,
including 21 notices/sidecars, in the candidate directory and independently in both candidate
ZIP entry streams. Neither final output has a separate `StartupFailure` chunk or dynamic
recovery-component import; the recovery component is included in the main bundle.

The Windows build used Node 24.14.1 and the explicitly selected cached dfx 0.31.0-beta.1,
retaining the exact version guard and real anonymous public-key query. Build-only tool values
did not leak into artifacts. The candidate used only process-local
`OC_TRANSFORMERS_WEBGPU_IMAGE_SPIKE=true` and
`OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY=immutable-hub-v1`; production defaults and app-card
capability gates remain unchanged. No dependency installation, fresh audit or inventory upload
was part of this validation.

These builds were **not warning-free**. Default production logged 581 TS6054 unsupported
`.svelte` extension diagnostics; the candidate, run after parallel typechecks ended, logged
none. Causation is unproven and no compiler workaround was applied. Svelte, Sass, CSS URL,
source-map, circular-dependency and optional-wallet warnings remain. Separate passing
typecheck results above are not a claim that Rollup emitted no diagnostics.

Local validation records are `openchat-pr2-merged-production-final-summary-20260906.json`
and `openchat-pr2-merged-production-build-review-20260906.md`; final per-mode artifacts and
reports carry the `post-startup-fix-20260906` suffix. Earlier outputs without that suffix are
pre-fix evidence only. These are frontend packaging results with `inferenceVerified:false`,
not a refreshed APK, Android component execution, account reuse, passkey, app-card or
physical-device all-WebGPU acceptance result. Separate local-test APK evidence appears above
and does not require the publisher-only signing/version/upload prerequisites below.

After these frontend bundle runs, Android's build-only optional-defaults loader was corrected
for fresh checkouts. A missing optional `.env` file is accepted; an existing malformed,
nonregular or unreadable file fails. Caller-supplied outer values retain precedence over file
defaults. Five real-shell regressions increased the offline policy/helper aggregate from 193
to 198 passing tests; the 2,450-test frontend result is unchanged. The actual local-test APK
result is recorded above, not inferred from these shell tests or frontend bundle results.

## Published source and submission state before reconciliation

The published integration checkpoint is `2029f00d726ca7c33de22c53c24cf1ada173d3fb`
on `codex/pr2-clean-integration`, tagged `model-integration-checkpoint-2026-09-05`.
The lint cleanup, compatible dependency updates, portable security hashes, CI coverage,
Android release safeguards and this preparation package follow that immutable checkpoint.
Use the preparation commit SHA for further validation; never move the checkpoint tag.
The earlier local-test APK source was `551265bbeff8191ed36d0446bc8ef1d54edf74f8`.
It included the generic voice, runtime-settings and worker-rebuild follow-ups and superseded
the `e02bd70d4` artifact at that time. It is now historical, not the current merged-source
candidate. Its cold startup was not accepted because emulator private-network DNS was not
configured for its backend; that historical result is retained below.

| Submission                                                                 | Observed head                                | Base                           | State                         |
| -------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------ | ----------------------------- |
| [Upstream PR #9132](https://github.com/open-chat-labs/open-chat/pull/9132) | `codex/pr1-local-models`, `045f7132e`        | upstream `master`              | Draft; no reported check runs |
| [Fork PR #73](https://github.com/ktimam/open-chat/pull/73)                 | `codex/pr2-app-chat-interfaces`, `c7299aa11` | `codex/pr1-local-models`       | Draft; no reported check runs |
| Historical APK preparation source                                          | `codex/pr2-clean-integration`, `551265bbe`   | descends from both heads above | Not either PR's current head  |

The integration checkpoint is 16 commits / 115 changed files beyond PR #73's head.
Those commits mix later model-runtime fixes and app-interface fixes. It is 60 commits beyond
PR #9132's head. Do not present this checkpoint as a PR2-only refresh without separating scope.
Upstream `master` was rechecked at `df9d9ed52db00e87fbb7309280a325902c9bb2cc`:
the checkpoint and upstream have 98 and 126 unique commits respectively. Since the first
assessment, upstream added Play signing-key association and legacy-install migration notices.
Its Android package-identity migration must be reviewed explicitly when reconciling the stack;
do not uninstall or change the existing local-test package/account identity as a merge side effect.
The checkpoint itself does not contain the newly validated local conflict resolutions above.

## Preserve the two-PR structure

The latest bounded source-boundary review checked 5,336 tracked PR2 text files and
4,936 tracked PR1 text files, plus 18 additional PR1 source files. It found no prohibited
app contracts, field-role assumptions or private machine identifiers; the existing PR2
boundary audit also passed across its separate 5,276-file scope. Manual inspection of
candidate matches confirmed that financial/image-label fixtures exercise caller-supplied
schema, caption and keyword inputs rather than host-owned business rules. This is a
bounded scan and surface review, not proof of semantic absence in every repository path.

The Android build-generated source review found no machine/cache paths in 65 tracked
Android and plugin-permission text files. The apparent manifest/Gradle/permission drift
was line-ending or regeneration metadata; schema coverage matches the incoming PR1
source for all 31 commands. Only the local Kotlin build cache was newly ignored, without
deleting diagnostics or ignoring application source.

1. Refresh PR1 with generic model catalog/runtime, installation/cache, optional audio,
   native bridge, model settings and their tests. Keep third-party app structures out.
2. Refresh PR2 on the resulting PR1 head with manifests, registered processing surfaces,
   cards, scoped linking/private context, attestation, confirmation and inbox delivery.
3. Review mixed files such as inference routing, message menus, startup and native identity
   by hunk and dependency. Do not blindly cherry-pick all 16 integration commits into either PR.
4. Validate each resulting head independently, then validate the combined stack. Retarget
   PR2 to upstream `master` only after PR1 integration is agreed with maintainers.
5. Update existing PR descriptions rather than create duplicate submissions. Prepared bodies:
   [PR1](pr1-local-models.md) and [PR2](pr2-app-interfaces.md).

The [stack refresh plan](pr-stack-refresh-plan.md) identifies the reviewed scope split and
append-only inheritance. PR1's generic follow-ups and PR2's reconciliation are committed
locally; the declaration/contract follow-ups were validated before commit as changes atop PR2.
Neither published PR head has changed. Dependency remediation, final-head hosted checks and runtime acceptance
remain separate gates.

This is a proposed publishing sequence, not an executed history rewrite. Keep the checkpoint
tag available for comparison; do not move it to a rebased or lint-cleaned head.

## Historical integration verification (before upstream reconciliation)

Results below use isolated integration source plus the current fixes and exact updated
frontend lockfile, not refreshed PR1/PR2 heads. The production web build was run; no signed
shipping APK was built or accepted.

The historical `551265bbe` local-test ARM64 APK was built and installed over the emulator's existing
package without uninstalling or clearing data. It is 84,773,670 bytes, SHA-256
`04c1579baf8f3d5012388863bc7280b455cbaf31af6746993937ede5e44c4bf5`, with the existing
local Android debug certificate and `com.oc.app` identity (native version `0.1.0`, code `1000`).
That APK served frontend version `2.0.0-local-webgpu-551265bbe-20260906` and OTA policy
`none`. Its 26 served runtime/graph/notice assets match the built hashes; the actual WebView
imports ORT, compiles the pinned WASM and receives acknowledgement from its packaged worker.
The v2 welcome screen eventually renders. The initial startup-only probe captured the spinner;
a controlled cold restart then exceeded the 30-second WebView readiness limit. The later
rendered screen is not a passing cold-start result. Diagnosis found that the emulator cannot
resolve the configured private backend (`net::ERR_NAME_NOT_RESOLVED`), while the host reaches
the same status endpoint successfully. Bundled UI loads in 2.9 seconds; an existing registry
retry/gating path delays onboarding until 50.7 seconds. This behavior predates the model
changes in both PR1 and current upstream. No model assets load during startup. Emulator DNS
and private-network routing need validation before repeating the unchanged readiness check;
no APK-origin, account, guest-file or network-settings workaround was applied.
The emulator is at sign-in and exposes no WebGPU adapter, so authenticated model settings,
account linking, image/voice inference and model proposals were not verified. This artifact
is not publisher-signed and was not uploaded. The configured builder's known Gradle fallback
ran only after a freshly compiled ARM64 library; build and fresh-artifact checks passed.

| Check                                                                                       | Result                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full frontend unit tests, current integration follow-up                                     | 133 files / 1,862 passed with four workers; zero skipped tests                                                                                                                               |
| Svelte typecheck, current integration follow-up                                             | 0 errors; 546 warnings in 195 files                                                                                                                                                          |
| Agent TypeScript check                                                                      | Passed                                                                                                                                                                                       |
| Read-only ESLint                                                                            | 0 errors; 31 existing warnings (26 errors corrected)                                                                                                                                         |
| Frozen isolated dependency install                                                          | Passed; model/ONNX/OCR runtime lock entries unchanged                                                                                                                                        |
| Release/CI/digest/format/preflight/archive/notice tests                                     | 147 passed, zero skipped                                                                                                                                                                     |
| Current frontend CI policy test command, including SBOM lock identity and model CI coverage | 134 passed, zero skipped; narrower command than the historical aggregate above                                                                                                               |
| Production WebGPU candidate build                                                           | Passed in 2m55.5s with the final frozen dependency tree, explicit immutable-delivery contract and real public-key query; both store/full OTA ZIPs produced                                   |
| Built WebGPU payload                                                                        | 26 exact assets verified: worker, ORT pair, two Qwen graphs and 21 notices/sidecars; this is packaging evidence, not inference                                                               |
| Built module browser smoke                                                                  | Chrome 152.0.7977.76 imports actual ORT JS, compiles pinned WASM and receives disposal acknowledgement from the compiled worker under the built CSP; no model inference or full-app UI claim |
| Immutable download endpoints                                                                | 52/52 public HEAD checks passed: 26 unbundled base/audio files × web/APK origins, expected lengths and CORS headers; no body-hash or browser-enforcement claim                               |
| Actual OTA ZIP round trip                                                                   | 3 tests passed on Windows; corrected UTF-8 archive also extracted with Android's actual `zip@2.4.2` dependency, preserving six files' exact names and bytes                                  |
| Diff whitespace check                                                                       | Passed                                                                                                                                                                                       |
| App/host boundary audit                                                                     | 5,145 text files / no findings; rerun after any scope split                                                                                                                                  |
| Hosted checks on existing PRs                                                               | None reported; not a pass                                                                                                                                                                    |
| Affected backend Rust packages                                                              | 57 tests passed, 1 existing ignored test; strict Clippy and workspace formatting passed                                                                                                      |
| Nine affected backend library targets, current integration follow-up                        | 590 tests passed, none ignored; combined strict Clippy passed for library and test targets                                                                                                   |
| Native model-manager follow-up                                                              | 23 tests passed, none ignored; default-feature strict Clippy passed for library and test targets                                                                                             |
| Hosted native model checks on `753d2cecc`                                                   | Linux and Windows hermetic tests and both feature builds passed; separate pinned native CPU model inference passed                                                                           |
| Signed shipping APK / production rollout                                                    | Not built or performed                                                                                                                                                                       |

### Latest completed hosted checks: exact `769689f4f`

- [Frontend](https://github.com/ktimam/open-chat/actions/runs/34039358129): the complete
  frontend pipeline and candidate packaging build passed, including the previous lint repair.
- [Model checks](https://github.com/ktimam/open-chat/actions/runs/34039358119): frontend model
  contracts, Windows/Linux native tests and feature builds, and actual inference with the
  pinned 14 MB native CPU fixture passed. That CPU fixture is not phone WebGPU proof.
  The earlier `551265bbe` frontend-model job did not run its tests because the ONNX Node
  installer download failed (`ETIMEDOUT` / `ENETUNREACH`); the new run verifies those same
  source tests successfully. The dependency job checked 291 formatted
  files without a formatting error, then failed the expired baseline and reviewed dependency
  drift. Its later Rust/license/SBOM steps were skipped; no security allowance was raised.
- [Backend](https://github.com/ktimam/open-chat/actions/runs/34039358377): full unit tests
  and formatting passed. The verifier fixture's two needless borrows no longer fail. Strict
  Clippy progressed to one further test-module ordering finding in `principal_to_user_id_map`.
  Its test module is now moved after the unchanged default implementation; the authorization
  generation test, scoped strict Clippy and workspace formatting pass locally. The follow-up
  still needs the complete hosted workspace Clippy run. Backend CI now preserves the exact
  lockfile and uses `--keep-going` to collect independent lint errors in one run, while retaining
  fatal warnings and the same test scope. A red-to-green policy regression guards those options.
- [App security](https://github.com/ktimam/open-chat/actions/runs/34039358128): review expiry,
  reviewed dependency drift and advisory policy still fail. Fresh npm audits for the current
  integration lock reported two moderate findings and no high/critical findings in both scopes;
  the moderate count exceeds the old policy's one-finding allowance. No allowance was raised.

Local backend follow-up repairs the duplicate permission arm, adds exhaustive provenance and
role tests, applies narrow documented lint expectations to existing public API representations,
and boxes only three private prepared-deposit payloads. The affected chat-events, group-chat,
group, community and user targets pass 146 tests and focused strict Clippy. A further mechanical
inbox cleanup preserves cursor iteration and replaces test-only temporary vectors; its 60
tests pass, bringing the first focused total to 206. Subsequent user-index, group-index and
local-user-index repairs bring the combined nine-target total to 590 passing tests and strict
Clippy. These changes retain stored structures and public wire payloads; only transient lookup
results are boxed, with value, persistence and expiry-boundary regressions. The historical full
Windows workspace Clippy attempt stopped at the local Cygwin-Perl/MSVC OpenSSL incompatibility.
The September 7 full locked/offline pass above supersedes that local blocker, not the need
for full hosted Linux CI. Card-authorization requirements
are unchanged by these repair batches.

The development model-worker watcher now includes its full generic helper list. A helper edit
rebuilds the worker and rotates its runtime version only after success; generated output is not
watched. The sequential-session transform is imported afresh on each attempt, including retries
after build or syntax failures. Tests exercise the real transpiled Vite plugin with controlled
build/watch fixtures. This closes a stale-development-worker path, not a phone GPU acceptance gate.

The dedicated model workflow previously selected only eight named test files and did not trigger
for many worker/runtime edits. It now selects model test families and relevant source/build/notice
paths. A regression inventories the actual test files and verifies both workflow selection and
Vitest discovery. This also exposed an existing WASM packaging suite excluded by the root Vitest
configuration; that suite is now included. The exact expanded model command passes 29 suites /
418 tests. Full frontend CI was already broader; neither suite is physical-device inference proof.

The subsequent generic voice closure now exercises both composers and the real media-reader /
storage transport path. Public downloads retain image-only defaults (5 MiB / four queries)
and require explicit audio selection (10 MiB / seven queries). The public actor is anonymous,
does not retry, and shares a 12-second deadline through headers and body consumption. An
independent review reproduced a stalled-body escape from the original timer; the corrected
helper now aborts and cancels that stream, with a red-to-green regression. Early reader
rejections also abort unread bodies. These bounds do not prove that arbitrary containers
decode successfully or that a model transcribes them accurately.

Mounted runtime-settings tests prevent stale optional-audio completion from updating a new
model or a destroyed component. Generic `/ai` tests cover both UI handlers, staged/replied
media, exact account/chat/thread capture and duplicate-run guards. Unsupported audio is
rejected before legacy browser/native text-only inference. The full frontend result above
includes these changes; no CPU/provider fallback or app-specific extraction was introduced.

### Earlier build failures and their repairs

Hosted checks on `808a75d3e` exposed failures that unit tests did not cover:

- [Frontend run](https://github.com/ktimam/open-chat/actions/runs/33994920416):
  unit, type and lint checks passed; the production bundle failed because `dfx` was absent.
  Both frontend and Android CI now install the repository-pinned `dfx` version using the
  immutable official setup action. The real public-key query is retained, not replaced with a fixture.
- [Backend run](https://github.com/ktimam/open-chat/actions/runs/33994920435):
  fixed formatting, an equivalent derived `Default`, and deprecated fixed-array conversions.
  The affected packages passed local strict tests; the subsequent complete hosted run exposed
  the additional backend failures recorded above.
- [Model security run](https://github.com/ktimam/open-chat/actions/runs/33994920417)
  and [app security run](https://github.com/ktimam/open-chat/actions/runs/33994920407):
  security expiry/drift remains a failure. Separately, all 82 source formatting failures were
  corrected with exact Prettier output; all 284 policy candidates including manifests now pass.
  The checker invokes installed Prettier directly in bounded batches so Windows' shell command
  length limit cannot prevent checking large candidate sets. Every batch failure remains fatal.

The local Windows production build passed the real public-key query and Rollup type declarations,
then exposed a missing `zip` executable at OTA packaging. Packaging now uses Windows' built-in
ZIP-capable `bsdtar`, retaining Info-ZIP on Unix, and passes literal arguments without a shell.
The complete typecheck/lint/test/production pipeline then passed with the final dependency tree.
A subsequent UTF-8 charset repair passed a broader Japanese/Arabic filename regression and
Android's actual Rust archive consumer; both real OTA ZIPs were regenerated with that repair.
The browser smoke imports the actual emitted runtime and starts its compiled worker. The pinned
ORT module retains Node-only guarded imports of `module` and `worker_threads`; a blanket claim
that all emitted modules have no bare imports would be incorrect. Optional dependency warnings
alone were not treated as proof of a broken browser bundle. Unix Info-ZIP retains a pre-existing
non-ASCII filename/Rust-reader incompatibility: current public/build payload paths are ASCII,
but qualify non-ASCII paths before introducing them into Unix-built OTA archives.

Earlier physical-phone evidence established all-WebGPU model generation in a local development
APK. Complete partner-app card verification still requires a passing live run. Emulator replay
does not prove physical GPU generation; its WebView had no WebGPU adapter. Do not collapse unit,
replayed integration, real inference and fully rendered/verified card evidence into one pass.
The 2026-09-06 emulator check used WebView 151.0.7922.199 in the running APK: `navigator.gpu`
exists but both default and high-performance adapter requests return null. It cannot prove the all-WebGPU path.

The isolated install used npm `10.8.2` and local Node `24.14.1`. Frontend, Android and security
CI now agree on Node `24.18.1`; the complete hosted frontend checks on `e02bd70d4` passed
under that runtime. Later source changes still require their own validation.
CI uses read-only lint and frozen install, with no ad-hoc Rollup install that mutates the lockfile.
The local Windows production query used installed WSL `dfx@0.27.0`; CI pins the repository's
declared `0.31.0-beta.1`; the hosted frontend run above now passes with that exact toolchain.

## Security gates: blocked

Both [PR1](../../.github/security/openchat-pr1-security-baseline.json) and
[PR2](../../.github/security/openchat-pr2-security-baseline.json) policies expired on
2026-08-31. Current manifests/lockfiles no longer match their reviewed digests. PR2 also reports
unreviewed native Cargo manifests. These failures were observed, not waived.

The cross-platform hash defect is corrected without approving new dependencies: 23 historical
records now hash UTF-8 with CRLF normalized to LF, backed by exact reconstruction of their
original reviewed bytes. The unproven PR2 root Cargo manifest remains byte-exact and fails.
Expiry, advisory allowances, reviewed file set and other policy fields remain unchanged.
The sole subsequent policy correction changes PR1's expected Node setup count from two
to three, matching the dependency, Android-component and frontend jobs. Actual-workflow
regressions reject missing, extra, relocated or wrongly pinned steps. Both checkouts pass
their offline helper suites (PR1 96; PR2 338); the real policy check still fails expiry and
dependency drift. Only the stale Node-count diagnostic disappeared. No expiry extension,
digest approval or advisory waiver was added. Evidence:
`ci-setup-count-20260907-auth-display/green-summary.json` and `preservation-proof.json`.
The repair was committed locally as PR1 `9686bfaac6fa8d994bca88656e77315f1ab09df7`
and PR2 `bdb5c00ff1c9c4c5ee2f805affed94f2f29b8750`; neither was pushed.

PR1 subsequently received the selective generic dependency backport in
`d0fed022537c325b52458cff6df3184510063eb0`: h2 0.4.16, event-listener 5.4.2,
removal of the unused legacy DynamoDB TLS connector, and optional debug telemetry with
the existing development opt-in preserved. Unrelated PR1 dependencies were not copied
from PR2. Locked/offline metadata and Android feature graphs, exact Rust formatting and
102 Node helpers passed. All three actual DynamoDB compatibility tests also passed, with
2,580 recorded source inputs unchanged; these use synthetic credentials and loopback HTTP,
not live AWS or a TLS handshake. Evidence: `pr1-remediation-review-20260907-39d104c9/validation.json`
and `pr1-dynamodb-runs/launch-d649cf2d8354452cb620a5fb038f5bdf/summary.json`.
This backport is not a fresh advisory audit or native model acceptance on PR1.

The following CI regression reproduced PR1's omission of the six launcher tests from
its actual frontend helper command. Adding that selection fixes the failure; both branches
now reject absent, commented, wrongly placed or non-enforcing test steps and filtered events.
The final offline helper suites pass 104/104 for PR1 and 340/340 for PR2, with no skips;
these are local source checks, not hosted execution or an advisory audit. Evidence:
`android-dev-ci-routing-20260907-9393afd3214e4924a3099c9f738601bc/green-summary.json`.

Fresh npm advisory results on 2026-09-06 for published `e02bd70d4`, after the scoped overrides:

| Dependency scope | High | Moderate | Low | Critical |
| ---------------- | ---- | -------- | --- | -------- |
| Production       | 0    | 2        | 0   | 0        |
| All              | 0    | 2        | 0   | 0        |

The public lockfile was byte-matched to SHA-256
`b68b016ac2d66b72e80a383db020b8b8502a36cb57802d29e72463f0bdc51b01` before the
independent audit. Hosted PR2 checks report the same counts. Both moderate entries arise from
one dependency chain, `@solana/web3.js@1.98.4` → `jayson@4.3.0` → `stream-json@1.9.1`,
and [GHSA-528h-pc64-c93x](https://github.com/uhop/stream-json/security/advisories/GHSA-528h-pc64-c93x).
The advertised patched `stream-json` major is incompatible with the installed parent; an
unverified override is not a fix. An isolated `jayson@4.1.3` downgrade satisfied Solana's
declared range and its Node/browser client checks, but restored parser regressions: malformed
JSON acceptance, missing incomplete-input errors and broken split UTF-8 input. It also retained
the demonstrated nested-prototype mutation. The downgrade was rejected and the current lockfile
retained; `npm audit`'s `fixAvailable` field is not a verified safe remediation. These results
do not close the Rust, license, SBOM or
exact-PR-base dependency review.

Historical npm results for `808a75d3e`, before those scoped overrides:

| Dependency scope | High | Moderate | Low | Critical |
| ---------------- | ---- | -------- | --- | -------- |
| Production       | 5    | 3        | 0   | 0        |
| All              | 5    | 6        | 0   | 0        |

Compatible updates reduced the all-dependency total from 20 to 11 in this audit snapshot.
Tiptap is locked to 3.31.3 and DOMPurify to 3.4.14, above their patched minimums;
see the [Tiptap fix](https://github.com/ueberdosis/tiptap/releases/tag/v3.30.4) and
[DOMPurify advisory](https://github.com/cure53/DOMPurify/security/advisories/GHSA-55q2-fjhq-7xh7).
At that snapshot, remaining chains included Coinbase SDK/axios, Transformers/ONNX Node/adm-zip,
Transformers/sharp, jayson/stream-json and rollup-styles/query-string/decoder.
The local follow-up now pins only the reviewed Coinbase SDK `1.52.0`'s Axios to `1.18.1`.
An offline test against the actual installed SDK verifies signed request paths, BigInt serialization,
headers, responses, error mapping and retry integration, with an ephemeral key and no requests.
The compatibility check runs in frontend CI and requires reassessment if the SDK version changes.
The `query-string@8.2.0` decoder is separately pinned to `decode-uri-component@0.5.0` after
275 decoding cases, actual query-string option checks and a bounded malformed-input regression.
The repeatable installed-tree test is also in CI. Further scoped overrides now select
`adm-zip@0.6.0` only under `onnxruntime-node@1.24.3` and `sharp@0.35.3` only under
`@huggingface/transformers@4.2.0`. The actual ONNX installer passes 11 extraction/copy/cleanup
and bounded-allocation checks using an offline NuGet fixture. The actual Transformers Node
image helper passes 42 checks across image formats, channels, resampling, crop and padding;
24 independent old/new pixel-hash comparisons are identical. The frozen install retains all
optional packages, including cross-platform native wrappers. No model, ONNX or OCR runtime
version was changed. A `stream-json@3` override was rejected because the current `jayson`
parent requires incompatible CommonJS subpaths. Its Node TCP/CLI parser also reproduces
inherited-property injection; browser client reachability differs, which does not remediate the
installed Node package. Both security policies still fail; the older counts are retained
only to explain the remediation, not as the current lockfile audit.
A smaller overall total does not excuse a category increase.
These are dependency findings, not demonstrated browser exploitability. Assess runtime
reachability, especially Node-only transitive dependencies of browser model packages;
remediate or explicitly review residual risk, licenses and lockfile changes before replacing
the baseline. A complete license/SBOM review is also still required.

A fresh official RustSec database (`5a0ebedfe8bdd2e295b171f4162f8c977bcad9a5`, updated
2026-09-02) was fetched into isolated storage without uploading dependency inventory. The
unchanged Cargo lockfile now reports **7 vulnerabilities / 32 warnings**, above the reviewed
5/30 snapshot. New findings include `RUSTSEC-2026-0258` for `h2@0.3.27` and `h2@0.4.15`,
plus yanked `chacha20@0.10.1` and `wnaf@0.14.0`. Do not reuse the earlier stale offline audit
as release evidence. Follow-up fixes update `h2@0.4` to `0.4.16` and `event-listener` to `5.4.2`,
and select the existing DynamoDB SDK's modern default HTTPS client without its unused legacy
TLS feature. This removes the vulnerable old `rustls-webpki` chain. Tests exercise real signed
DynamoDB requests against a local fixture server; strict Clippy passes. The native plugin's
22 tests also pass. Developer telemetry is now an explicit optional Cargo feature; normal and
all-WebGPU Android dependency graphs no longer contain the legacy `h2@0.3` chain. The
existing development opt-in remains available through `npm run mobile` and its tested launcher.

The current lockfile audit with that database and `--no-fetch --no-yanked` reports 3
vulnerabilities, 3 unsound findings and 26 unmaintained findings. Remaining vulnerabilities
are `h2@0.3.27` in explicitly enabled developer tooling and two RSA versions without a patched
range (`0.9.10`, `0.10.0-rc.18`). Optional dependencies remain visible in the lockfile audit;
they were not suppressed. This command does not recheck registry yanks. Residual-risk review
and the expired security policies remain unresolved; no baseline was raised.

Offline Cargo metadata still matches the 19 PR1 introduced and four PR2 direct reviewed
package/license tuples. This is narrower than distribution clearance. The all-WebGPU asset
configuration now emits version-checked Wllama/embedded component notices independently of OCR,
and ORT/Transformers/model notices with the WebGPU payload. Modified Qwen graphs receive adjacent
notice sidecars. Immutable source cards and hashes document Gemma's optional audio and both graph
transform stages; the missing conversion-publisher metadata is stated, not invented. The built
distribution verifier requires the exact runtime, graphs and all 21 notice/sidecar outputs.
These checks establish packaging and attribution coverage, not inference or complete conversion
reproducibility. The stale `open` notice now matches locked `5.4.1`.

The pinned `cargo-cyclonedx@0.5.9` generator was also executed for the native model plugin with
`inference` features and all targets. It emitted 508 components; all 507 external package
identities/checksums in its isolated lockfile matched source `Cargo.lock` SHA-256
`04de513dc25b67d786d0650c17362fe5dece72d9a879c171e93e695d3d5aa33d`.
Because this generator has no `--locked` flag, the wrapper now forces offline resolution,
rejects source-lock mutation or isolated dependency drift before writing the report, and adds
both raw lock hashes and the scope as report metadata. Ten regression tests cover allowed
pruning and rejected version/source/checksum, Git revision and malformed-record changes.
This is subset lock-identity evidence, not dependency-edge/feature completeness, path-source
content proof, a full APK/model-weight SBOM or license/advisory acceptance. The policy command
still exits nonzero for the expired baseline and reviewed dependency drift; no waiver was added.

Frontend, backend and model/app security workflows now include the stacked PR base and
integration pushes, with regression tests for that routing. These changes are not on the
two older PR heads yet. Candid event routing and fail-closed checker regressions are now
covered locally, and the complete local parity run now passes as recorded above. Hosted
and broader integration workflows still need coordinated validation on the final stack.
Private/custom-runner jobs were not enabled blindly.
Absence of hosted check runs must not be reported as success.

## Publisher-only shipping guidance: not a local APK prerequisite

The developer will not build or publish the actual distribution APK. The signing, release
version, upload and rollout items in this section are handoff guidance for its publisher,
not outstanding requests for the developer's credentials or barriers to using the local APK.
Source/PR review and physical-device testing remain separate from APK publication.

- [All-WebGPU feature gating](../../frontend/app/transformersWebGpuFeatureFlag.mjs) retains
  development + local network + explicit opt-in. A separate production candidate contract,
  `OC_TRANSFORMERS_WEBGPU_ASSET_DELIVERY=immutable-hub-v1`, uses immutable Hub weight URLs
  and same-origin packaged Qwen graphs, ORT and worker. The development flag alone still
  cannot enable production. CI separately builds and verifies this candidate; that does not
  activate the shipping workflow or substitute for device/cache/CORS acceptance.
- [App capability gates](../../frontend/app/rollup.config.mjs) deliberately disable unfinished
  app-card features in production/testnet. Keep these security brakes until backend rollout
  and authorization acceptance are complete; frontend flags are not backend authority.
- [Android release workflow](../../.github/workflows/android_release.yaml) now accepts only
  exact `vX.Y.Z-android` tags or an explicit manual version input. It requires successful
  frontend, backend and both security workflows for the exact checked-out SHA before building
  and again before uploading. Missing, failed, queued, skipped, truncated, wrong-source or
  PR synthetic-merge evidence is rejected; workflow paths and individual jobs are checked.
  It uses read-only [GitHub Actions evidence](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow),
  not display-name matching. Old immutable tags still contain their old workflow:
  **do not publish the checkpoint tag as a GitHub Release**.
- That workflow builds native `inference` / `inference,store`, not the tested local
  `transformers-webgpu-android` path. Select and validate the intended shipping runtime first.
- CI now requires configured release signing and a pinned certificate for manual and published
  artifacts; no temporary/debug-key fallback. Local developer signing is unchanged. Actual
  release key configuration and application-link identity still require verification.
- The reviewed upstream formula derives the native version code as
  `major * 1,000,000 + minor * 10,000 + patch`, with validated bounds and matching Tauri/Gradle
  inputs. Full APK and store AAB identity/signatures are checked separately. Verify progression
  against the actual last distributed version code; supplying an inconsistent code is rejected.
  Local testing still uses its existing native version policy, not a fabricated publishing version.
- Android CI and Gradle now pin NDK `26.1.10909125` and build-tools `35.0.0`, matching
  the inspected local APK's native build note and Gradle execution history. APK verification
  requires that exact build-tools version. The existing Gradle `8.14.4` distribution has its
  [official SHA-256](https://gradle.org/release-checksums/) pinned; `dfx` is `0.31.0-beta.1`.
  These are source/toolchain preparation checks, not a rebuilt signed APK acceptance result.
- Verify production origin, model assets,
  optional audio, application links, account reuse and OTA policy in the final artifact.
- Run actual repeated image proposals and optional voice-message flows on supported hardware,
  including model switching, cached model reuse and explicit disabled/unavailable paths.

Generated APK resources are excluded by the precise root ignore rule. Source model graphs,
manifests and their notices remain tracked. No local account state, private environment file,
test profile, generated APK or signing material belongs in the submission.

## Backend rollout gate

Follow the [app-link security contract](../../architecture/ai-app-link-security.md) and
[ActionInbox rollout requirements](../../backend/canisters/action_inbox/README.md#v4-rollout-compatibility).
Coordinated versioned delivery, signing-key activation and independent consumer pins, inbox
wiring, legacy-queue handling and snapshot/rollback restrictions are separate acceptance gates.
Direct-chat deposits are not currently a supported backend rollout claim. Do not relax these
requirements to obtain a successful UI test.

## Reproduction and next actions

Run from a fresh isolated checkout of each proposed head with its exact dependency lockfile.
Do not reuse the running development server's checkout for a production build.

```sh
cd frontend
npm ci --no-audit
npm test -- --reporter=dot
npm run typecheck
npm run typecheck:agent
npm run lint:check
cd ..
node --test 'scripts/*.test.mjs'
node scripts/cdp_axios_compatibility.mjs
node scripts/decoder_compatibility.mjs
node scripts/release_preflight.mjs
node scripts/check_openchat_pr1_security.mjs ci npm
node scripts/check_openchat_pr2_security.mjs ci npm
git diff --check
```

The security commands are currently expected to fail; preserve their findings. Run Rust,
license, formatting and SBOM gates with the documented pinned tools after dependency review.
Commands that contact advisory services or upload dependency inventory require separate
explicit consent; fresh current-lock audit consent remains outstanding for this merged tree.
Then run the coordinated backend integration tests and a clean shipping build. Do not update
PR readiness, publish a GitHub Release, upload APKs, enable production features or deploy until
the corresponding gates pass and those actions are explicitly authorized.

`release_preflight.mjs` is an offline inventory, not a release approval command. It checks the
actual immutable model manifests, optional audio separation, source assets, toolchain declarations
and security drift without downloads, signing or deployment. It intentionally returns a nonzero
status while external acceptance remains unverified. Optional version progression inputs must
come from the last actually distributed artifact, not guessed examples.
The report separates `gitHeadRevision` and `worktreeDirty`: it reads current working-tree and
installed asset bytes, not an atomic attestation that every input belongs to the Git commit.
