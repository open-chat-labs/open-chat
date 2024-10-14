#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

rm -rf ./tsBindings

for canister_path in ./backend/canisters/*/
do
  canister_path=${canister_path%*/}
  canister_name=${canister_path##*/}

  cargo run -p ${canister_name}_canister > /dev/null
done

cargo run -p ts_exporter

cd frontend/openchat-agent

npm run typebox

awk '{sub(/import { Type, Static/,"import { Type, type Static")}1' ./src/typebox.ts > ./tmp.ts
mv tmp.ts ./src/typebox.ts