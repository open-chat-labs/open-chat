#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/generate-wasm.sh group_canister_impl
./scripts/generate-wasm.sh group_index_canister_impl
./scripts/generate-wasm.sh notifications_canister_impl
./scripts/generate-wasm.sh online_users_aggregator_canister_impl
./scripts/generate-wasm.sh proposals_bot_canister_impl
./scripts/generate-wasm.sh user_canister_impl
./scripts/generate-wasm.sh local_user_index_canister_impl
./scripts/generate-wasm.sh user_index_canister_impl
