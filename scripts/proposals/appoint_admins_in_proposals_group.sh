#!/bin/sh

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Appoint @Hamish, @julian_jelfs, and @Matt as admins of the OpenChat Proposals group"
SUMMARY="For each of these users, the proposals_bot will call into the group canister corresponding to the given governance canister to set the user's role within the group to admin.\n\nThis will allow them to update the group description, set the group avatar, and moderate messages if necessary."

GOVERNANCE_CANISTER_ID="2jvtu-yqaaa-aaaaq-aaama-cai"
HAMISH_USER_ID="3skqk-iqaaa-aaaaf-aaa3q-cai"
JULIAN_USER_ID="2yfsq-kaaaa-aaaaf-aaa4q-cai"
MATT_USER_ID="27eue-hyaaa-aaaaf-aaa4a-cai"

# add_platform_operator args
ARGS="(record { governance_canister_id = principal \"$GOVERNANCE_CANISTER_ID\"; users = vec {principal \"$HAMISH_USER_ID\"; principal \"$JULIAN_USER_ID\"; principal \"$MATT_USER_ID\"} })"
FUNCTION_ID=4002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
