#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
PACKAGE="${CANISTER_NAME}_canister_impl"

if [ -z "${CARGO_HOME}" ]
then
  export CARGO_HOME="${HOME}/.cargo"
fi

if [ -z "${GIT_COMMIT_ID}" ]
then
  export GIT_COMMIT_ID=$(git rev-parse HEAD)
fi

echo Building package $PACKAGE
export RUSTFLAGS="--remap-path-prefix $(readlink -f ${SCRIPT_DIR}/..)=/build --remap-path-prefix ${CARGO_HOME}/bin=/cargo/bin --remap-path-prefix ${CARGO_HOME}/git=/cargo/git"
for l in $(ls ${CARGO_HOME}/registry/src/)
do
  export RUSTFLAGS="--remap-path-prefix ${CARGO_HOME}/registry/src/${l}=/cargo/registry/src/github ${RUSTFLAGS}"
done
cargo build --locked --target wasm32-unknown-unknown --release --package $PACKAGE || exit 1

echo Optimising wasm
if ! cargo install --list | grep -Fxq "ic-wasm v0.9.11:"
then
  echo Installing ic-wasm
  cargo install --version 0.9.11 ic-wasm || exit 1
fi
ic-wasm ./target/wasm32-unknown-unknown/release/$PACKAGE.wasm -o ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm shrink $NAME_SECTION_FLAG || exit 1
ic-wasm ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm -o ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm optimize Oz $NAME_SECTION_FLAG || exit 1
# Note: wasm-opt's single-use inliner can inflate serde deserialize functions for large
# enums past ICP's 1,000,000 function-complexity limit. If this happens, add a second
# wasm-level call site for the offending type's deserialize function (see
# local_user_index/impl/src/no_inline_anchor.rs for the pattern). Two call sites prevent
# single-use inlining of that function.

echo Compressing wasm
mkdir -p wasms
gzip -fckn9 target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm > ./wasms/$CANISTER_NAME.wasm.gz
