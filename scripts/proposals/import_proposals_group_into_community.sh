#!/bin/sh

# Extract the args
GOVERNANCE_CANISTER_ID=$1
GROUP_ID=$2
COMMUNITY_ID=$3
NAME=$4
COMMUNITY_NAME=$5

TITLE="Import the '$NAME Proposals' group into the '$COMMUNITY_NAME' community"
SUMMARY="Import the [$NAME Proposals](https://oc.app/group/$GROUP_ID) group into the [$COMMUNITY_NAME](https://oc.app/community/$COMMUNITY_ID) community."

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_platform_operator args
ARGS="(record { governance_canister_id=principal \"$GOVERNANCE_CANISTER_ID\"; community_id=principal \"$COMMUNITY_ID\"; })"
FUNCTION_ID=4003

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
