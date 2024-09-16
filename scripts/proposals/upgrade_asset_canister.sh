#!/bin/bash

# cd into the folder containing this script
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/../..

DFX_VERSION=$1

TITLE="Upgrade asset canister to DFX version $DFX_VERSION"
URL="https://github.com/dfinity/sdk/releases/tag/$DFX_VERSION"
CANISTER_NAME=website
SUMMARY="This proposal upgrades the asset canister wasm to the version included in DFX $DFX_VERSION"
FUNCTION_ID=3

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./sns/scripts/utils/setup_env.sh

# Make the proposal
TARGET_CANISTER_ID=$(dfx -qq canister --network $NETWORK id $CANISTER_NAME)

# Build the WASM path
WASM_FILE=$CANISTER_NAME.wasm.gz
WASM_PATH=$WASM_FOLDER/$WASM_FILE

# Make the proposal using quill
quill sns --canister-ids-file ././sns/scripts/utils/sns_canister_ids.json --pem-file $PEM_FILE make-upgrade-canister-proposal --title "$TITLE" --url "$URL" --summary "$SUMMARY" --target-canister-id $TARGET_CANISTER_ID --wasm-path $WASM_PATH $PROPOSER_NEURON_ID --mode upgrade > msg.json
quill send msg.json
rm -f msg.json

# Cleanup
./sns/scripts/utils/cleanup_env.sh
