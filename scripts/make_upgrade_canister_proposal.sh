#!/bin/bash

# cd into root of OpenChat repo
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport

# We'll re-organise these folders after SNS launch
./sns/scripts/utils/setup_env.sh

# Extract the args
FUNCTION_ID=$1
CANISTER_NAME=$2
VERSION=$3
TITLE=$4
CHANGELOG=$5

TAG=v$VERSION-$CANISTER_NAME
COMMIT_ID=$(git rev-list -n 1 tags/$TAG) || exit 1
URL="https://github.com/open-chat-labs/open-chat/releases/tag/$TAG"

echo "TITLE: $TITLE"
echo "TAG: $TAG"
echo "COMMIT_ID: $COMMIT_ID"
echo "URL: $URL"

# Download the canister WASM at the given commit
./scripts/download-canister-wasm.sh $CANISTER_NAME $COMMIT_ID || exit 1

WASM_FILE=$CANISTER_NAME.wasm.gz
WASM_PATH=$WASM_FOLDER/$WASM_FILE
WASM_HASH=$(sha256sum $WASM_PATH | sed 's/ .*$//')

SUMMARY="## GitHub commit

https://github.com/open-chat-labs/open-chat/commit/$COMMIT_ID

## Changelog

$CHANGELOG

## Wasm Verification

Verify that the hash of the gzipped WASM matches the proposed hash.

\`\`\`
git fetch
git checkout $COMMIT_ID
./scripts/verify-release.sh $VERSION $WASM_HASH
\`\`\`"

echo "SUMMARY:
$SUMMARY"

if [ "$FUNCTION_ID" -ge "1000" ] ; then
    # Setup variables
    PROPOSAL_BUILDER_FOLDER=$SCRIPT_DIR/../backend/canister_upgrade_proposal_builder
    PROPOSAL_FILE=proposal.candid
    PROPOSAL_BUILDER_PATH=$PROPOSAL_BUILDER_FOLDER/$PROPOSAL_FILE

    # Build the proposal file
    cd $PROPOSAL_BUILDER_FOLDER
    cargo run --quiet -- --title "$TITLE" --summary "$SUMMARY" --url "$URL" --function-id $FUNCTION_ID --wasm-path "$WASM_PATH" --version $VERSION > $PROPOSAL_FILE

    # cd back into root of OpenChat repo
    cd $SCRIPT_DIR/..

    # Submit the proposal
    ./sns/scripts/utils/submit_proposal_file.sh $PROPOSAL_BUILDER_PATH

    rm -f $PROPOSAL_BUILDER_PATH
else
    # Submit the proposal
    ./sns/scripts/utils/submit_upgrade_proposal.sh $CANISTER_NAME $VERSION "$TITLE" "$URL" "$SUMMARY"
fi

# Cleanup
./sns/scripts/utils/cleanup_env.sh
