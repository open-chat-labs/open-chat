#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1

if ! command -v jq &> /dev/null
then
  echo "Please install jq then try again (https://jqlang.org/download)"
  exit 1
fi

URL=$(jq ".canisters.${CANISTER_NAME}.wasm" dfx.json)
URL=$(echo "$URL" | tr -d '"')

mkdir -p wasms
cd wasms

echo "Downloading $CANISTER_NAME wasm"

if ! ../scripts/cached-download.sh "$URL" ${CANISTER_NAME}.wasm.gz
then
    echo "Failed to download wasm: ${CANISTER_NAME}"
    exit 1
fi

echo "Downloaded $CANISTER_NAME wasm"