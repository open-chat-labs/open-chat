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
CANISTER_NAME=$1
VERSION=$2
TITLE=$3
URL=$4
SUMMARY=$5

echo "CANISTER_NAME=$CANISTER_NAME"
echo "VERSION: $VERSION"
echo "TITLE: $TITLE"
echo "URL: $URL"
echo "SUMMARY: $SUMMARY"

# Download the canister WASM
./scripts/download-canister-wasm-dfx.sh $CANISTER_NAME || exit 1

./sns/scripts/utils/submit_upgrade_proposal.sh $CANISTER_NAME $VERSION "$TITLE" "$URL" "$SUMMARY" "()"

# Cleanup
./sns/scripts/utils/cleanup_env.sh
