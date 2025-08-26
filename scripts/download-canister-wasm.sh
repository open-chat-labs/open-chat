#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
WASM_SRC=$2 # WASM_SRC is either empty, "latest", "prod" the commit Id or the release version

if [[ -z $WASM_SRC ]] || [[ $WASM_SRC == "latest" ]]
then
  COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
elif [[ $WASM_SRC == "prod" ]] || [[ $WASM_SRC =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]
then
  if [[ $WASM_SRC == "prod" ]]
  then
    CANISTER_TAG_ID=$(git tag -l --sort=-version:refname "*-$CANISTER_NAME" | head -n 1)
  else
    CANISTER_TAG_ID=$(./scripts/get-canister-version.sh $CANISTER_NAME $WASM_SRC)
  fi

  if [[ -z $CANISTER_TAG_ID ]]
  then
    # If the canister has not been released yet then download the latest version
    COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
  else
    COMMIT_ID=$(git rev-list $CANISTER_TAG_ID -1)
  fi
else
  COMMIT_ID=$WASM_SRC
fi

echo "Downloading $CANISTER_NAME wasm at commit $COMMIT_ID"

mkdir -p wasms
cd wasms

HTTP_CODE=$(curl -sO https://openchat-canister-wasms.s3.amazonaws.com/$COMMIT_ID/$CANISTER_NAME.wasm.gz --write-out "%{http_code}")

if [[ ${HTTP_CODE} -ne 200 ]] ; then
    echo "Failed to download wasm: ${CANISTER_NAME}. Response code: ${HTTP_CODE}"
    exit 1
fi

echo "Downloaded $CANISTER_NAME wasm"
