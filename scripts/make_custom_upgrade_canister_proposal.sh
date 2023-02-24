#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport

# We'll re-organise these folders after SNS launch
../sns/scripts/utils/setup_env.sh

# Extract the args
FUNCTION_ID=$1
CANISTER=$2
WASM_SRC=$3
VERSION=$4
TITLE=$5
URL=$6
SUMMARY=$7

PACKAGE="$CANISTER"_canister_impl

# Ensure the wasms folder contains the desired wasm version
if [ $WASM_SRC = "latest" ]
then
    ./download-canister-wasm.sh $CANISTER
elif [ $WASM_SRC = "build" ]
then
    ./generate-wasm.sh $PACKAGE
elif [ $WASM_SRC != "local" ]
then
    ./download-canister-wasm.sh $CANISTER $WASM_SRC
fi

cd ../backend/canister_upgrade_proposal_builder

# Locate the WASM
WASM_PATH='../../wasms/'"$PACKAGE"'.wasm.gz'

# Build the proposal file
PROPOSAL_FILE=proposal.candid
cargo run --quiet -- --title "$TITLE" --summary "\"$SUMMARY\"" --url "$URL" --function-id $FUNCTION_ID --wasm-path "$WASM_PATH" --version $VERSION > $PROPOSAL_FILE

cd $SCRIPT_DIR

# Submit the proposal
# We'll re-organise these folders after SNS launch
../sns/scripts/utils/submit_proposal_file.sh $SCRIPT_DIR/../backend/canister_upgrade_proposal_builder/$PROPOSAL_FILE

# Cleanup
rm -f ../backend/canister_upgrade_proposal_builder/$PROPOSAL_FILE
../sns/scripts/utils/cleanup_env.sh
