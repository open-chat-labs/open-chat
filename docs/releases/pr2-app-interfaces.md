# Draft update: generic in-chat cards and external-app processing

Target: existing [fork PR #73](https://github.com/ktimam/open-chat/pull/73), stacked on the
refreshed model PR. Keep draft status; retarget upstream only after the stack is agreed.
This is a prepared description, not a PR update or publication action.

## Summary

Provide reusable registered app interfaces for chat: bounded manifests and app enablement,
scoped linking, isolated app-authored cards, private context, exact content attestation,
user-reviewed confirmation and authenticated delivery.

The newer integration checkpoint adds a generic app-owned local processor. An app declares
the protocol in its registered schema and receives bounded text/OCR evidence for extraction,
or model candidates for normalization. The host supplies inference and validation plumbing;
the app owns interpretation, labels, field meanings and final backend constraints.

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

The pre-commit upstream-reconciled source passed 190 frontend files / 2,550 tests,
both typechecks and read-only lint on September 7.
The full backend unit workspace also passed 957 tests with one existing ignored test;
full strict backend Clippy now passes the locked/offline workspace with test targets and
warnings treated as errors, excluding only the two native-shell packages. This includes integration-test
compilation, not execution. The separate Candid parity result is recorded below; integration
execution remains unverified.
The reconciliation is committed locally at PR2 `cdceb9d127a329b49a82795662fadba77ab2f18f`,
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
The September 6 APK below predates these source fixes. The newer September 7 welcome APK
passed three cold starts with installed-asset verification, but still predates the final
worker-logging and mobile-theme fixes. It must be rebuilt and retested before representing
current source. See [the latest APK evidence](model-app-readiness.md#latest-tested-local-apk-september-7-welcome-final-source-rebuild-required)
for its exact identity and acceptance limits; no physical-device inference or authenticated
app-card acceptance is implied.

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
credentials or publication approval; it does not waive the release/security gates below.

### Remaining publication gates

The existing PR is 16 commits behind the integration checkpoint and includes no reported
hosted checks. Refresh and independently validate its app-only scope after PR1 is refreshed.
Do not copy the combined checkpoint into this PR while calling it app-interface-only.

Release remains blocked by expired/drifted dependency policies, fresh advisory findings,
complete final-head CI, coordinated backend rollout and artifact/runtime acceptance. Publisher
signing/version requirements are separate from the requested locally signed test APK.
See [release readiness](model-app-readiness.md) for the exact snapshot and required sequence.
This draft does not request production activation or claim release readiness.
