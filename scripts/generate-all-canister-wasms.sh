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

echo Building wasms
export RUSTFLAGS="--remap-path-prefix $(readlink -f ${SCRIPT_DIR}/..)=/build --remap-path-prefix ${CARGO_HOME}/bin=/cargo/bin --remap-path-prefix ${CARGO_HOME}/git=/cargo/git"
for l in $(ls ${CARGO_HOME}/registry/src/)
do
  export RUSTFLAGS="--remap-path-prefix ${CARGO_HOME}/registry/src/${l}=/cargo/registry/src/github ${RUSTFLAGS}"
done

cargo build --locked --target wasm32-unknown-unknown --release \
  --package airdrop_bot_canister_impl \
  --package community_canister_impl \
  --package cycles_dispenser_canister_impl \
  --package escrow_canister_impl \
  --package event_relay_canister_impl \
  --package group_canister_impl \
  --package group_index_canister_impl \
  --package identity_canister_impl \
  --package local_group_index_canister_impl \
  --package local_user_index_canister_impl \
  --package market_maker_canister_impl \
  --package neuron_controller_canister_impl \
  --package notifications_canister_impl \
  --package notifications_index_canister_impl \
  --package online_users_canister_impl \
  --package openchat_installer_canister_impl \
  --package proposal_validation_canister_impl \
  --package proposals_bot_canister_impl \
  --package registry_canister_impl \
  --package storage_bucket_canister_impl \
  --package storage_index_canister_impl \
  --package translations_canister_impl \
  --package user_canister_impl \
  --package user_index_canister_impl || exit 1

echo Optimising wasms
if ! cargo install --list | grep -Fxq "ic-wasm v0.9.0:"
then
  echo Installing ic-wasm
  cargo install --version 0.9.0 ic-wasm || exit 1
fi

ic-wasm ./target/wasm32-unknown-unknown/release/airdrop_bot_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/airdrop_bot_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/community_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/community_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/cycles_dispenser_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/cycles_dispenser_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/escrow_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/escrow_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/event_relay_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/event_relay_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/group_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/group_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/group_index_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/group_index_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/identity_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/identity_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/local_group_index_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/local_group_index_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/local_user_index_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/local_user_index_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/market_maker_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/market_maker_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/neuron_controller_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/neuron_controller_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/notifications_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/notifications_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/notifications_index_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/notifications_index_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/online_users_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/online_users_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/openchat_installer_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/openchat_installer_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/proposal_validation_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/proposal_validation_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/proposals_bot_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/proposals_bot_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/registry_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/registry_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/storage_bucket_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/storage_bucket_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/storage_index_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/storage_index_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/translations_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/translations_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/user_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/user_canister_impl-opt.wasm shrink
ic-wasm ./target/wasm32-unknown-unknown/release/user_index_canister_impl.wasm -o ./target/wasm32-unknown-unknown/release/user_index_canister_impl-opt.wasm shrink

echo Compressing wasms
mkdir -p wasms
gzip -fckn9 target/wasm32-unknown-unknown/release/airdrop_bot_canister_impl-opt.wasm > ./wasms/airdrop_bot.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/community_canister_impl-opt.wasm > ./wasms/community.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/cycles_dispenser_canister_impl-opt.wasm > ./wasms/cycles_dispenser.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/escrow_canister_impl-opt.wasm > ./wasms/escrow.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/event_relay_canister_impl-opt.wasm > ./wasms/event_relay.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/group_canister_impl-opt.wasm > ./wasms/group.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/group_index_canister_impl-opt.wasm > ./wasms/group_index.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/identity_canister_impl-opt.wasm > ./wasms/identity.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/local_group_index_canister_impl-opt.wasm > ./wasms/local_group_index.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/local_user_index_canister_impl-opt.wasm > ./wasms/local_user_index.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/market_maker_canister_impl-opt.wasm > ./wasms/market_maker.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/neuron_controller_canister_impl-opt.wasm > ./wasms/neuron_controller.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/notifications_canister_impl-opt.wasm > ./wasms/notifications.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/notifications_index_canister_impl-opt.wasm > ./wasms/notifications_index.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/online_users_canister_impl-opt.wasm > ./wasms/online_users.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/openchat_installer_canister_impl-opt.wasm > ./wasms/openchat_installer.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/proposal_validation_canister_impl-opt.wasm > ./wasms/proposal_validation.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/proposals_bot_canister_impl-opt.wasm > ./wasms/proposals_bot.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/registry_canister_impl-opt.wasm > ./wasms/registry.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/storage_bucket_canister_impl-opt.wasm > ./wasms/storage_bucket.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/storage_index_canister_impl-opt.wasm > ./wasms/storage_index.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/translations_canister_impl-opt.wasm > ./wasms/translations.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/user_canister_impl-opt.wasm > ./wasms/user.wasm.gz
gzip -fckn9 target/wasm32-unknown-unknown/release/user_index_canister_impl-opt.wasm > ./wasms/user_index.wasm.gz
