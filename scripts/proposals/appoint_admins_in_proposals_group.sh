#!/bin/sh

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Appoint @kinic_developer_org as admin of the Kinic Proposals group"
SUMMARY="For each given user, the proposals_bot will call into the group canister corresponding to the given governance canister, to set the user's role within the group to admin.\n\nThis will allow them to update the group description, set the group avatar, and moderate messages if necessary."

GOVERNANCE_CANISTER_ID=74ncn-fqaaa-aaaaq-aaasa-cai
USER_ID=b2vtn-faaaa-aaaar-aok7q-cai

# add_platform_operator args
ARGS="(record { governance_canister_id = principal \"$GOVERNANCE_CANISTER_ID\"; users = vec {principal \"$USER_ID\"; } })"
FUNCTION_ID=4002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
