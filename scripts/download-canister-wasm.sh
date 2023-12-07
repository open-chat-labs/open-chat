#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

CANISTER_NAME=$1
WASM_SRC=$2 # WASM_SRC is either empty, "latest", "prod" the commit Id or the release version

if [[ -z $WASM_SRC ]] || [[ $WASM_SRC == "latest" ]]
then
  COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
elif [[ $WASM_SRC == "prod" ]]
then
  COMMIT_ID=$(jq -r .$CANISTER_NAME ./canister_commit_ids.json)
elif [[ $WASM_SRC =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]
  echo "here1"
  if [[ $(git tag -l $WASM_SRC) ]]
  then
    echo "here2"
    RELEASE_TAG_ID=$WASM_SRC
  else
    echo "here3"
    RELEASE_TAG_ID=$(git tag -l "$WASM_SRC-*")
  fi

  CHILD_COMMIT_ID=$(git rev-list --ancestry-path $RELEASE_TAG_ID..HEAD | tail -1)
  if [[ -z $CHILD_COMMIT_ID ]]
  then
    echo "here4"
    CANISTER_TAG_ID=$(git tag -l --sort=-version:refname "*-$CANISTER_NAME" | head -1)
  else
    echo "here5"
    CANISTER_TAG_ID=$(git tag -l --no-contains $CHILD_COMMIT_ID --sort=-version:refname "*-$CANISTER_NAME" | head -1)
  fi

  if [[ -z $CANISTER_TAG_ID ]]
  then
    echo "here6"
    # If the canister has not been released yet then download the latest version
    COMMIT_ID=$(git rev-parse HEAD)
  else
    echo "here7"
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
    echo "Failed to download wasm. Response code: ${HTTP_CODE}"
    exit 1
fi

echo "Wasm downloaded"
