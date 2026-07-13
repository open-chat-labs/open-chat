#!/bin/bash

# Submits the SNS proposal which points the user_index at the
# personhood_verifier canister. Until this runs, the user_index rejects the
# verifier's proof notifications and does not fan out embedding deletion on
# account deletion.
#
# Usage: ./set_personhood_verifier_canister_id.sh CANISTER_ID [SUMMARY]

CANISTER_ID=$1
SUMMARY=${2:-"Sets the personhood_verifier canister id on the user_index to $CANISTER_ID so that unique personhood proofs are accepted from it and account deletion fans out embedding deletion to it."}

TITLE="Set personhood_verifier canister id on user_index"
URL="https://github.com/open-chat-labs/open-chat/issues/9072"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# set_personhood_verifier_canister_id args
ARGS="(record { canister_id=principal \"$CANISTER_ID\" })"
FUNCTION_ID=1016

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
