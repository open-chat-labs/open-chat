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
TITLE=$2
SUMMARY=$3
URL=$4
ARGS=$5

# Candid encode the payload as binary
PAYLOAD=$(didc encode "$ARGS" --format blob)

# Build the proposal candid
PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {ExecuteGenericNervousSystemFunction = record {function_id=($FUNCTION_ID:nat64); payload=$PAYLOAD}}})"

# Submit the proposal
./sns/scripts/utils/submit_proposal.sh "$PROPOSAL"

# Cleanup
./sns/scripts/utils/cleanup_env.sh
