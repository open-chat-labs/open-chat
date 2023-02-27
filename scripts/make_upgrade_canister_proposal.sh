#!/bin/sh

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
COMMIT_ID=$3
VERSION=$4
TITLE=$5
URL=$6
SUMMARY=$7

# Download the canister WASM at the given commit commit
./scripts/download-canister-wasm.sh $CANISTER_NAME $COMMIT_ID

if [ "$FUNCTION_ID" -ge "1000" ] ; then
    # Setup variables
    WASM_FILE="$CANISTER_NAME"_canister_impl.wasm.gz
    WASM_PATH=$WASM_FOLDER/$WASM_FILE
    PROPOSAL_BUILDER_FOLDER=$SCRIPT_DIR/../backend/canister_upgrade_proposal_builder    
    PROPOSAL_FILE=proposal.candid
    PROPOSAL_BUILDER_PATH=$PROPOSAL_BUILDER_FOLDER/$PROPOSAL_FILE

    # Build the proposal file
    cd $PROPOSAL_BUILDER_FOLDER
    cargo run --quiet -- --title "$TITLE" --summary "\"$SUMMARY\"" --url "$URL" --function-id $FUNCTION_ID --wasm-path "$WASM_PATH" --version $VERSION > $PROPOSAL_FILE

    # cd back into root of OpenChat repo
    cd $SCRIPT_DIR/..

    # Submit the proposal
    ./sns/scripts/utils/submit_proposal_file.sh $PROPOSAL_BUILDER_PATH

    rm -f $PROPOSAL_BUILDER_PATH
else
    # Submit the proposal
    ./sns/scripts/utils/submit_upgrade_proposal.sh $CANISTER_NAME $VERSION "$TITLE" "$URL" "$SUMMARY"
fi

# Tag the git commit with the version
TAG=v$VERSION-$CANISTER_NAME
git tag $TAG $COMMIT_ID
git push origin tag $TAG

# Update the canister_commit_ids.json locally
SCRIPT=$(echo "jq '.$CANISTER_NAME = \"$COMMIT_ID\"' canister_commit_ids.json")
eval $SCRIPT > canister_commit_ids_new.json
mv canister_commit_ids_new.json canister_commit_ids.json

# Cleanup
./sns/scripts/utils/cleanup_env.sh
