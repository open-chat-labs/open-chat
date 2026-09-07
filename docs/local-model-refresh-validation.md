# Local model refresh validation

Assessment: 2026-09-06. This records a locally validated model-only refresh, not production
release approval or physical-device acceptance. The published model PR head remains
`045f7132e502ba01c56343800217070aa2ce4ea0` until the existing PR is explicitly refreshed.

## Scope

- Generic all-WebGPU Qwen/Gemma runtime, worker lifecycle and compilation fixes.
- Cache-preserving model selection, per-file installation identity and both model-manager UIs.
- Optional Gemma audio installation with stale-operation and component-destruction guards.
- Generic `/ai` handling for staged or explicitly replied image/voice messages in both UIs.
- Bounded public media loading with explicit audio selection, anonymous requests, no retries,
  and a shared deadline covering response headers and body consumption.
- Native capability probing; unsupported audio fails explicitly before text-only inference.
- Model asset notices, worker rebuild dependencies, portable archives and CI test discovery.

Third-party app protocols, card construction, app-defined field semantics, OCR action modes,
private-projector hooks and model-output evidence annotations are excluded from this slice.
Explicit all-WebGPU selection never changes to a CPU/native/provider inference fallback.

## Evidence

| Check                               | Result                                              |
| ----------------------------------- | --------------------------------------------------- |
| Full frontend tests                 | 66 suites / 872 passed; no skipped tests            |
| Svelte typecheck                    | 0 errors, 560 existing warnings                     |
| Agent TypeScript check              | Passed                                              |
| Read-only frontend lint             | 0 errors, 30 existing warnings                      |
| Exact model-workflow test selection | 31 suites / 452 passed                              |
| Generic Node policy step            | 32 passed, including 12 CI coverage regressions     |
| Native default-feature library      | 18 tests and strict Clippy passed                   |
| Actual development worker emission  | Main, model and service workers built successfully  |
| Generic import closure              | No missing relative imports across 54 reached files |

The old model workflow's invalid workspace command was reproduced as failing. New coverage
tests inspect real test files, Vitest discovery, PR triggers and literal prefix selectors.
Mounted settings tests cover model-switch/unmount races. Transport tests reproduce the
response-body deadline gap before the fix and verify abort/cancel cleanup afterward.
Composer tests execute real handlers and media readers; they do not run model weights.

Dependency lock and runtime package versions are unchanged. Package script changes only add
read-only CI linting. No dependency-policy expiry, advisory allowance or reviewed hash is waived.
The feature-enabled native local test could not finish because SDK access was denied; the
default-feature result does not substitute for that build. Native CI now compiles both
application feature sets on Linux and Windows, but has not run on this unpublished refresh.

## Still required

Complete the exact-base dependency review, reconcile current upstream, validate the full
production build and combined PR stack, and require hosted checks on final PR heads.
Real-device model accuracy and GPU stability remain distinct from these local checks.
The requested APK is a locally signed test artifact; publisher credentials, store uploads
and production OTA activation are not part of this preparation.
