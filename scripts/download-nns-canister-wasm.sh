#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
FILE_NAME=$2

COMMIT_ID=${3:-ec35ebd252d4ffb151d2cfceba3a86c4fb87c6d6}

echo "Downloading $CANISTER_NAME at commit $COMMIT_ID"

mkdir -p wasms
cd wasms

if ! ../scripts/cached-download.sh https://download.dfinity.systems/ic/$COMMIT_ID/canisters/$FILE_NAME.wasm.gz $CANISTER_NAME.wasm.gz
then
    echo "Failed to download wasm: ${CANISTER_NAME}"
    exit 1
fi

echo "Downloaded $CANISTER_NAME wasm"
