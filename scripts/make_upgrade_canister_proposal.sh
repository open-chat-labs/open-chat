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
CHUNKED=${6:-false}
DFX_IDENTITY=${7:-default}

TAG=v$VERSION-$CANISTER_NAME
COMMIT_ID=$(git rev-list -n 1 tags/$TAG) || exit 1
URL="https://github.com/open-chat-labs/open-chat/releases/tag/$TAG"

echo "TITLE: $TITLE"
echo "TAG: $TAG"
echo "COMMIT_ID: $COMMIT_ID"
echo "URL: $URL"

if ! command -v sha256sum &> /dev/null
then
    echo "sha256sum could not be found, please install it then try again"
    exit 1
fi

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
    PROPOSAL_BUILDER_FOLDER=$SCRIPT_DIR/../backend/tools/canister_upgrade_proposal_builder
    PROPOSAL_FILE=proposal.candid
    PROPOSAL_BUILDER_PATH=$PROPOSAL_BUILDER_FOLDER/$PROPOSAL_FILE

    if [ "$CHUNKED" == "true" ] ; then
      echo "Canister wasm chunks uploader building"
      cargo build --package canister_wasm_chunks_uploader

      echo "Canister wasm chunks uploader starting"
      cargo run --package canister_wasm_chunks_uploader -- \
        --url "https://ic0.app/" \
        --dfx-identity $DFX_IDENTITY \
        --openchat-installer jodzs-iqaaa-aaaar-qamqa-cai \
        --user-index 4bkt6-4aaaa-aaaaf-aaaiq-cai \
        --group-index 4ijyc-kiaaa-aaaaf-aaaja-cai \
        --canister-to-upload $CANISTER_NAME \
        --version $VERSION || exit 1

      echo "Canister wasm chunks uploader completed"
    fi

    # Build the proposal file
    cargo run --package canister_upgrade_proposal_builder --quiet -- \
      --title "$TITLE" \
      --summary "$SUMMARY" \
      --url "$URL" \
      --function-id $FUNCTION_ID \
      --canister-name $CANISTER_NAME \
      --wasm-path "$WASM_PATH" \
      --version $VERSION > $PROPOSAL_FILE

    # Submit the proposal
    ./sns/scripts/utils/submit_proposal_file.sh $PROPOSAL_BUILDER_PATH

    rm -f $PROPOSAL_BUILDER_PATH
else
    # Parse the version string
    IFS='.' read -ra VERSION_PARTS <<< "$VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}

    # Build the canister-upgrade-arg
    UPGRADE_ARG="(record { wasm_version = record { major=$MAJOR:nat32; minor=$MINOR:nat32; patch=$PATCH:nat32 } })"

    # Submit the proposal
    ./sns/scripts/utils/submit_upgrade_proposal.sh $CANISTER_NAME $VERSION "$TITLE" "$URL" "$SUMMARY" "$UPGRADE_ARG"
fi

# Cleanup
./sns/scripts/utils/cleanup_env.sh
