#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/../..

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./utils/setup_env.sh

# Extract the args
TITLE=$1
URL=$2
SUMMARY=$3
VERSION=$4
FUNCTION_ID=$5
CANISTER=$6

cd ./proposals/build_upgrade_canister_proposal

# Locate the WASM
WASM_PATH='../../../../wasms/'"$CANISTER"'_canister_impl.wasm.gz'

# Build the proposal file
PROPOSAL_FILE=proposal.candid
cargo run --quiet -- --title "$TITLE" --summary "\"$SUMMARY\"" --url "$URL" --function-id $FUNCTION_ID --wasm-path "$WASM_PATH" --version $VERSION > $PROPOSAL_FILE

# Submit the proposal
../../utils/submit_proposal_file.sh ../proposals/build_upgrade_canister_proposal/$PROPOSAL_FILE

# Cleanup
rm -f $PROPOSAL_FILE
../../utils/cleanup_env.sh
