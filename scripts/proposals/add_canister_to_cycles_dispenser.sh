#!/bin/sh

# Extract the args or use defaults
CANISTER_ID=$1
SUMMARY=${2:-"The CyclesDispenser holds a whitelist of canisters which are allowed to request cycles top ups. This proposal adds the new MarketMaker canister to that list."}

# Build the title
TITLE="Add MarketMaker canister to CyclesDispenser's whitelist"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_canister args
ARGS="(record { canister_id=principal \"$CANISTER_ID\" })"
FUNCTION_ID=6000

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
