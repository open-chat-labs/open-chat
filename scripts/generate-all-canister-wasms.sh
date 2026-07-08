#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if [ -z "${CARGO_HOME}" ]
then
  export CARGO_HOME="${HOME}/.cargo"
fi

if [ -z "${GIT_COMMIT_ID}" ]
then
  export GIT_COMMIT_ID=$(git rev-parse HEAD)
fi

CANISTERS=(
  airdrop_bot
  community
  cycles_dispenser
  escrow
  event_relay
  group
  group_index
  identity
  local_user_index
  market_maker
  neuron_controller
  notifications_index
  online_users
  openchat_installer
  proposal_validation
  proposals_bot
  registry
  sign_in_with_email
  storage_bucket
  storage_index
  personhood_verifier
  translations
  user
  user_index
)

echo Building wasms
export RUSTFLAGS="--remap-path-prefix $(readlink -f ${SCRIPT_DIR}/..)=/build --remap-path-prefix ${CARGO_HOME}/bin=/cargo/bin --remap-path-prefix ${CARGO_HOME}/git=/cargo/git"
for l in $(ls ${CARGO_HOME}/registry/src/)
do
  export RUSTFLAGS="--remap-path-prefix ${CARGO_HOME}/registry/src/${l}=/cargo/registry/src/github ${RUSTFLAGS}"
done

PACKAGES=()
for CANISTER in "${CANISTERS[@]}"; do
  PACKAGES+=(--package "${CANISTER}_canister_impl")
done
cargo build --locked --target wasm32-unknown-unknown --release "${PACKAGES[@]}" || exit 1

echo Optimising and compressing wasms
if ! cargo install --list | grep -Fxq "ic-wasm v0.9.11:"
then
  echo Installing ic-wasm
  cargo install --version 0.9.11 ic-wasm || exit 1
fi

mkdir -p wasms
for CANISTER in "${CANISTERS[@]}"; do
  PACKAGE="${CANISTER}_canister_impl"
  ic-wasm ./target/wasm32-unknown-unknown/release/$PACKAGE.wasm -o ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm shrink
  ic-wasm ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm -o ./target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm optimize Oz || exit 1
  gzip -fckn9 target/wasm32-unknown-unknown/release/$PACKAGE-opt.wasm > ./wasms/$CANISTER.wasm.gz
done

echo Finished generating wasms