#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if ! command -v sha256sum &> /dev/null
then
    echo "sha256sum could not be found, please install it then try again"
    exit 1
fi

RELEASE_VERSION=$1
EXPECTED_WASM_HASH=$2

[[ -z "$RELEASE_VERSION" ]] && { echo "Release version not provided" ; exit 1; }
[[ -z "$EXPECTED_WASM_HASH" ]] && { echo "Expected wasm hash not provided" ; exit 1; }

TAG_ID=$(git tag -l --sort=-version:refname "v${RELEASE_VERSION}-*")
GIT_COMMIT_ID=$(git rev-list $TAG_ID -1)
CANISTER_NAME=${TAG_ID#*-}

echo "Tag: $TAG_ID"
echo "Commit Id: $GIT_COMMIT_ID"
echo "Canister name: $CANISTER_NAME"

if [ ! -z "$(git status --porcelain)" ]; then
  echo "Working directory contains uncommitted changes, please try again with a clean working directory"
  exit 1
fi

./scripts/docker-build-all-wasms.sh || exit 1

WASM_HASH=$(sha256sum "./wasms/${CANISTER_NAME}.wasm.gz" | sed 's/ .*$//')

if [[ $WASM_HASH == $EXPECTED_WASM_HASH ]]
then
    echo "Success - hashes match"
else
    echo "Error - hashes do not match. Expected: $EXPECTED_WASM_HASH. Actual: $WASM_HASH"
fi
