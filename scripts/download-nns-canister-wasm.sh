#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
FILE_NAME=$2

COMMIT_ID=${3:-1612a202d030faa496e1694eed98be4179fca856}

echo "Downloading $CANISTER_NAME at commit $COMMIT_ID"

mkdir -p wasms
cd wasms

curl -so $CANISTER_NAME.wasm.gz https://download.dfinity.systems/ic/$COMMIT_ID/canisters/$FILE_NAME.wasm.gz

echo "$CANISTER_NAME wasm downloaded"