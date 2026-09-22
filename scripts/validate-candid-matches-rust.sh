#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANDID_FILES=()
PACKAGES=()
for canister_path in ./backend/*canisters/*/
do
  canister_path=${canister_path%*/}
  canister_name=${canister_path##*/}
  candid=${canister_path}/api/can.did

  if test -f "$candid"; then
    CANDID_FILES+=("$candid")
    PACKAGES+=(--package "${canister_name}_canister")
  fi
done

# Build every generator in one go: it lets cargo compile the packages in parallel, where running
# them one at a time below would build each one's dependencies serially
cargo build "${PACKAGES[@]}" || exit 1

for candid in "${CANDID_FILES[@]}"
do
  canister_path=$(dirname "$(dirname "$candid")")
  canister_name=${canister_path##*/}

  echo validating ${candid}
  cargo run -p ${canister_name}_canister > temp.did
  didc check --strict ${candid} temp.did || exit 1
  didc check --strict temp.did ${candid} || exit 1
done

rm temp.did
