#!/bin/bash

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

generated_candid=$(mktemp "${TMPDIR:-/tmp}/openchat-candid.XXXXXXXXXX") || exit 1
trap 'rm -f -- "$generated_candid"' EXIT

for canister_path in ./backend/*canisters/*/
do
  canister_path=${canister_path%*/}
  canister_name=${canister_path##*/}
  candid=${canister_path}/api/can.did

  if test -f "$candid"; then
    echo "validating ${candid}"
    cargo run --locked -p "${canister_name}_canister" > "$generated_candid" || exit 1
    didc check --strict "$candid" "$generated_candid" || exit 1
    didc check --strict "$generated_candid" "$candid" || exit 1
  fi
done
