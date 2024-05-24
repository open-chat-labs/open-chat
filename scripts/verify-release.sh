#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/check-docker-is-running.sh || exit 1

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

docker build -t openchat --build-arg git_commit_id=$GIT_COMMIT_ID --build-arg canister_name=$CANISTER_NAME . || exit 1

container_id=$(docker create openchat)
rm -rf wasms
docker cp $container_id:/build/wasms wasms
docker rm --volumes $container_id

WASM_HASH=$(sha256sum "./wasms/${CANISTER_NAME}.wasm.gz" | sed 's/ .*$//')

if [[ $WASM_HASH == $EXPECTED_WASM_HASH ]]
then
    echo "Success - hashes match"
else
    echo "Error - hashes do not match. Expected: $EXPECTED_WASM_HASH. Actual: $WASM_HASH"
fi
