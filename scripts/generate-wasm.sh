#!/bin/bash

# Builds the wasm of the canister given into wasms/. Every canister is compiled so that the wasm
# matches the one released when built on the same platform (see generate-all-canister-wasms.sh).

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")

if [ -z "$1" ]
then
  echo "Usage: generate-wasm.sh <canister name>"
  exit 1
fi

exec "${SCRIPT_DIR}/generate-all-canister-wasms.sh" "$1"
