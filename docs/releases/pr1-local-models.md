# Draft update: optional on-device inference and local model management

Target: existing [upstream PR #9132](https://github.com/open-chat-labs/open-chat/pull/9132).
Keep draft status. Replace the source SHA and verification evidence after the model-only
refresh has been assembled and independently checked; this body is not a publication action.

## Summary

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

Historical committed evidence: the isolated upstream-reconciled PR1 source at
`2a95a68ca93be77a8e5cff92220fba0f54684d4a` passed 120 frontend suites / 1,378 tests, both
typechecks, read-only lint and native default-feature tests. Its own frozen install was used
for separate real default and opt-in WebGPU production builds; emitted workers, directory
assets and both OTA archives were verified. Those results describe that committed source,
not the later working-tree changes.

Uncommitted follow-ups include generic Android component registration that separates
installed application identity from source classes, optional `.env` defaults that preserve
caller-supplied values and reject invalid existing files, and native onboarding error routing.
Android cancellation now stays on sign-in; only a genuine no-passkey response offers linking.
An earlier follow-up snapshot passed 121 frontend suites / 1,403 tests, including 25 actual
onboarding-handler regressions; that snapshot predates the following startup/authentication fixes.

Current source verification (September 7): the PR1 working tree passed 123 frontend suites /
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

Artifact boundary: the previously verified production bundles/OTA archives and the September 6
local-test APK predate the September 7 startup/authentication fixes. They do not verify an APK
containing the current working-tree follow-ups. The combined integration APK is also not a
model-only PR1 release artifact. Updated artifacts require a rebuild, verification of their
packaged assets and separate device acceptance before making those claims.

The refreshed source and dependency lock have not replaced the existing PR head, and fresh
dependency review plus complete hosted acceptance remain outstanding.

Before ready-for-review: validate the refreshed head against current upstream, repair and
refresh the expired dependency policy through an actual audit, run the expanded hosted checks,
repeat native/runtime tests and provide bounded real-device evidence. The requested APK is
for local testing only. Publisher signing, production asset distribution and OTA decisions
remain separate gates and do not require publisher credentials for that local build.

See [local upstream reconciliation](../local-model-upstream-reconciliation.md) for the
historical merge checks and their limits. No production activation is requested.
