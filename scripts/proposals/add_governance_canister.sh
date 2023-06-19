#!/bin/sh

# Extract the args or use defaults
GOVERNANCE_CANISTER_ID=$1
NAME=$2
TITLE=$3
SUMMARY=$4
URL=$5

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_platform_operator args
ARGS="(record { governance_canister_id=principal \"$GOVERNANCE_CANISTER_ID\"; name=\"$NAME\"; })"
FUNCTION_ID=4000

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
