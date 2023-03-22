#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/generate-wasm.sh cycles_dispenser
./scripts/generate-wasm.sh group
./scripts/generate-wasm.sh group_index
./scripts/generate-wasm.sh local_group_index
./scripts/generate-wasm.sh local_user_index
./scripts/generate-wasm.sh market_maker
./scripts/generate-wasm.sh notifications
./scripts/generate-wasm.sh notifications_index
./scripts/generate-wasm.sh online_users
./scripts/generate-wasm.sh proposals_bot
./scripts/generate-wasm.sh storage_bucket
./scripts/generate-wasm.sh storage_index
./scripts/generate-wasm.sh user
./scripts/generate-wasm.sh user_index
