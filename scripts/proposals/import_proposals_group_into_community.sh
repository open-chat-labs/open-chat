#!/bin/sh

# Extract the args
GOVERNANCE_CANISTER_ID=$1
COMMUNITY_ID=$2
TITLE=${3:-"Import the 'OpenChat Proposals' group into the 'OpenChat Official' community"}
SUMMARY=${4:-"Import the [OpenChat Proposals](https://oc.app/group/nsbx4-4iaaa-aaaar-afusa-cai) group into the [OpenChat Official](https://oc.app/community/dgegb-daaaa-aaaar-arlhq-cai) community."}

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_platform_operator args
ARGS="(record { governance_canister_id=principal \"$GOVERNANCE_CANISTER_ID\"; community_id=principal \"$COMMUNITY_ID\"; })"
FUNCTION_ID=4003

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
