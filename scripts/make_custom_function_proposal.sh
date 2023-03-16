#!/bin/sh

# cd into folder containong this script
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

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

# Make the proposal
./make_proposal.sh "$PROPOSAL"
