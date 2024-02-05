#!/bin/bash

GOVERNANCE_CANISTER_ID=$1
SNS_NAME=$2
USER_ID=$3
USERNAME=$4

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Appoint @$USERNAME as admin of the $SNS_NAME Proposals channel"
SUMMARY="This will allow them to update the channel description, set the avatar, and moderate messages if necessary."

# add_platform_operator args
ARGS="(record { governance_canister_id = principal \"$GOVERNANCE_CANISTER_ID\"; users = vec {principal \"$USER_ID\"; } })"
FUNCTION_ID=4002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
