#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

rm -rf ./tsBindings

canister_names=(
  community
  group
  group_index
  identity
  local_user_index
  notifications_index
  online_users
  proposals_bot
  registry
  storage_bucket
  storage_index
  translations
  user
  user_index
)

build_command_args=""
for canister_name in "${canister_names[@]}"; do
  build_command_args+=" --bin ${canister_name}_canister";
done

echo Building binaries
cargo build $build_cmd_args

echo Running binaries
for canister_name in "${canister_names[@]}"; do
  cargo run -p ${canister_name}_canister > /dev/null
done

cargo run -p ts_exporter

cd frontend/openchat-agent

npm run typebox

awk '{sub(/import { Type, Static }/,"import { Type, type Static }")}1' ./src/typebox.ts > ./tmp.ts
mv tmp.ts ./src/typebox.ts
awk '{sub(/"BigIntZero"/,"BigInt(0)")}1' ./src/typebox.ts > ./tmp.ts
mv tmp.ts ./src/typebox.ts