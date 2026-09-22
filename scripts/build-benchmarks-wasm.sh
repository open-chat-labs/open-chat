#!/usr/bin/env bash
set -Eeuo pipefail

# Builds the wasm that canbench runs (this is the `build_cmd` in canbench.yml). It is a script so
# that the "Build caches" workflow can run exactly the same build to warm the cache: cargo only
# reuses cached dependencies if the flags match, so keep this the single place the command lives.
#
# `--cfg getrandom_backend="custom"` selects getrandom's custom backend on wasm (see
# .cargo/config.toml). It must be repeated here because if the RUSTFLAGS env variable is set (eg.
# by the setup-rust-toolchain GitHub action, which exports RUSTFLAGS="-D warnings" by default),
# cargo ignores the rustflags in config.toml.
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR/.."

export RUSTFLAGS="--cfg getrandom_backend=\"custom\" ${RUSTFLAGS:-}"
cargo build -p benchmarks --release --target wasm32-unknown-unknown --locked
