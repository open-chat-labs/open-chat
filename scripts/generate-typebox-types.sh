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

for canister_name in "${canister_names[@]}"; do
  cargo run -p ${canister_name}_canister > /dev/null
done

cargo run -p ts_exporter

cd frontend

npm run typebox

awk '{sub(/import { Type, Static }/,"import { Type, type Static }")}1' ./openchat-agent/src/typebox.ts > ./tmp.ts
mv tmp.ts ./openchat-agent/src/typebox.ts
awk '{sub(/"BigIntZero"/,"BigInt(0)")}1' ./openchat-agent/src/typebox.ts > ./tmp.ts
mv tmp.ts ./openchat-agent/src/typebox.ts

# Mark every top-level schema as side-effect free so bundlers can drop the ones a
# given entry point (e.g. the service worker) never references.
sed -E 's|^(export const [A-Za-z0-9_]+ = )Type\.|\1/* @__PURE__ */ Type.|' ./openchat-agent/src/typebox.ts > ./tmp.ts
mv tmp.ts ./openchat-agent/src/typebox.ts

# keep the generated file prettier-clean after the rewrites above
npx prettier --write ./openchat-agent/src/typebox.ts
