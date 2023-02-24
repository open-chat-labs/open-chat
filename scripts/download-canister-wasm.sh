#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
COMMIT_ID=$2

if [ -z "$COMMIT_ID" ]
then
  COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
fi

echo "Downloading $CANISTER_NAME wasm at commit $COMMIT_ID"

mkdir -p wasms
cd wasms

curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/${CANISTER_NAME}_canister_impl.wasm.gz

echo "Wasm downloaded"