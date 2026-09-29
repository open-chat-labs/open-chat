---
name: integration-tests
description: How to build the canister wasms and run the Rust integration tests (backend/integration_tests) locally, reusing wasms other worktrees have already built. Use whenever running integration tests, building canister wasms for tests, or when a test needs rebuilt wasms after a backend change.
---

# Running the integration tests

Always go through `scripts/run-integration-tests.sh`. Don't run `generate-all-canister-wasms.sh`,
`generate-wasm.sh` or `cargo test --package integration_tests` directly: those rebuild every
canister in every worktree and skip the caches below.

```bash
./scripts/run-integration-tests.sh build <test threads> <test filter>
```

For example, `./scripts/run-integration-tests.sh build 6 multi_user_canister_tests` runs every
test in `multi_user_canister_tests`. The filter is a substring of the test path; omit it to run
everything (slow).

## What `build` does locally

- `scripts/generate-test-wasms.sh` only rebuilds the canisters whose inputs changed. When any
  have, cargo still compiles every canister, since it unifies features across the canisters in a
  build, but only the changed ones are optimised and cached. Each wasm is cached under `~/Library/Caches/openchat/test-wasms`, keyed by a hash of the source of every
  workspace crate the canister depends on (uncommitted changes included), the versions of the
  other crates it depends on, the toolchain and the build script. A canister built before by any worktree, on any branch, is
  copied from the cache in a second rather than rebuilt.
- Test wasms embed a fixed commit id and aren't built with the worktree's path in `RUSTFLAGS`, so
  a new commit doesn't rebuild every canister and sccache can share compiled crates between
  worktrees. They aren't the wasms which would be released; release builds are unchanged.
- PocketIC and the NNS, event store and prod User wasms are downloaded once per machine
  (`scripts/cached-download.sh`).

On CI (`$CI` set) everything is built and downloaded as before.

## Running them

- Run long suites in the background and check the result when notified.
- The output is very long (`--nocapture`). Look for `test result:`, `FAILED` and `panicked at`.

## Other useful forms

- `./scripts/generate-test-wasms.sh --dry-run` lists which canisters are cached and which would be
  built, without building anything.
- `./scripts/generate-test-wasms.sh <canister>...` builds (or copies) just those canisters, eg.
  `multi_user local_user_index`.
- `./scripts/run-integration-tests.sh local <threads> <filter>` runs the tests against the wasms
  already in `wasms/`, eg. after `generate-test-wasms.sh`.
