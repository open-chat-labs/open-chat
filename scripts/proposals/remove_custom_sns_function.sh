#!/bin/sh

# Extract the args or use defaults
TITLE=$1
URL=$2
FUNCTION_ID=$3
SUMMARY_PATH=$4

SUMMARY=`cat $SUMMARY_PATH`

# Set current directory to the OC root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/../..

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./sns/scripts/utils/setup_env.sh

# Build the proposal candid
PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {RemoveGenericNervousSystemFunction = $FUNCTION_ID:nat64}})"

# Submit the proposal
./sns/scripts/utils/submit_proposal.sh "$PROPOSAL"

# Cleanup
./sns/scripts/utils/cleanup_env.sh
