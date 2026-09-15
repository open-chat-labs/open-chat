#!/bin/bash

set -e

# Arguments: identity, canister, version, WASM source, trusted SHA-256.
# Use an empty WASM source ("") to build locally.

IDENTITY=$1
CANISTER_NAME=$2
VERSION=$3
WASM_SRC=$4 # WASM_SRC is either empty, "build", "latest", "local", "prod" the commit Id or the release version
EXPECTED_WASM_SHA256=$5

if [[ ! "$EXPECTED_WASM_SHA256" =~ ^[0-9A-Fa-f]{64}$ ]]; then
    printf '%s\n' 'Expected argument 5: exactly 64 ASCII hexadecimal characters for the trusted Wasm SHA-256.' >&2
    exit 2
fi

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR"

exec ./upgrade-canister.sh local http://127.0.0.1:8080/ "$IDENTITY" "$CANISTER_NAME" "$VERSION" "$WASM_SRC" "$EXPECTED_WASM_SHA256"
