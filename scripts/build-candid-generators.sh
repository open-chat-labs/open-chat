#!/bin/bash

# Builds the candid/TypeScript generator binary of every canister that has a candid file, in a
# single cargo invocation. validate-candid-matches-rust.sh runs the binaries this produces, and the
# "Build caches" workflow runs this script to warm the cache for it: the set of packages built
# together determines how cargo unifies dependency features, so the cache is only reusable if both
# build exactly the same set with exactly this command.
#
# Sets CANISTER_NAMES (the canisters found) for a caller which sources this script.

SCRIPT=$(readlink -f "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAMES=()
PACKAGES=()
for canister_path in ./backend/*canisters/*/
do
  canister_path=${canister_path%*/}
  canister_name=${canister_path##*/}

  if test -f "${canister_path}/api/can.did"; then
    CANISTER_NAMES+=("$canister_name")
    PACKAGES+=(--package "${canister_name}_canister")
  fi
done

if [ ${#PACKAGES[@]} -eq 0 ]; then
  echo "No canisters with a candid file found" >&2
  exit 1
fi

cargo build "${PACKAGES[@]}" || exit 1
