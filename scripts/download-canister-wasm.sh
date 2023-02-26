#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
WASM_SRC=$2 # WASM_SRC is either empty, "latest", "prod" or the commit Id

if [ -z "$WASM_SRC" ] || [ $WASM_SRC = "latest" ]
then
  COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
elif [ $WASM_SRC = "prod" ]
then
  COMMIT_ID=$(jq -r .$CANISTER_NAME ./canister_commit_ids.json)
else
  COMMIT_ID=$WASM_SRC
fi

echo "Downloading $CANISTER_NAME wasm at commit $COMMIT_ID"

mkdir -p wasms
cd wasms

curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/${CANISTER_NAME}_canister_impl.wasm.gz

echo "Wasm downloaded"