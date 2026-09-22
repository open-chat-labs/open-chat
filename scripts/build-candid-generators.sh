#!/bin/bash

# Builds the candid/TypeScript generator binary of every canister that has a candid file, in a
# single cargo invocation. validate-candid-matches-rust.sh runs the binaries this produces, and the
# "Build caches" workflow runs this script to warm the cache for it: the set of packages built
# together determines how cargo unifies dependency features, so the cache is only reusable if both
# build exactly the same set with exactly this command.
#
# For a script which sources this one (it calls `exit`, so only source it from a script, never
# from an interactive shell) it sets:
#   CANDID_FILES  - the candid file of each canister found
#   TARGET_DIR    - the cargo target directory the binaries were built into

SCRIPT=$(readlink -f "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR/.." || exit 1

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

if [ ${#PACKAGES[@]} -eq 0 ]; then
  echo "No canisters with a candid file found" >&2
  exit 1
fi

# Ask cargo where it puts the binaries rather than assuming ./target: CARGO_TARGET_DIR or a
# `build.target-dir` in a cargo config may point elsewhere
TARGET_DIR=$(cargo metadata --format-version 1 --no-deps | grep -o '"target_directory":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TARGET_DIR" ]; then
  echo "Failed to determine the cargo target directory" >&2
  exit 1
fi

cargo build "${PACKAGES[@]}" || exit 1
