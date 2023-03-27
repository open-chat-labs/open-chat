#!/bin/sh

# Pass in the dfx identity name
# eg './upgrade-canister-prod.sh openchat user_index 1.0.0'

IDENTITY=$1
CANISTER_NAME=$2
VERSION=$3
WASM_SRC=$4 # WASM_SRC is either empty, "build", "latest", "local", prod" or the commit Id

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

./upgrade-canister.sh ic https://ic0.app/ $IDENTITY $CANISTER_NAME $VERSION $WASM_SRC

TAG=v$VERSION-$CANISTER_NAME

COMMIT_ID=$(git rev-parse HEAD)
git tag $TAG $COMMIT_ID
git push origin tag $TAG

cd ..
SCRIPT=$(echo "jq '.$CANISTER_NAME = \"$COMMIT_ID\"' canister_commit_ids.json")
eval $SCRIPT > canister_commit_ids_new.json
mv canister_commit_ids_new.json canister_commit_ids.json
