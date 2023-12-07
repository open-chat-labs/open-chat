#!/bin/bash

TITLE="Increase max concurrent user canister upgrades to 50 per subnet"
SUMMARY="It currently takes 1.5 days for all user canisters to be upgraded.

By increasing the number of canisters that can be upgraded concurrently these upgrades should speed up."

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

ARGS="(record { value=50:nat32 })"
FUNCTION_ID=1004

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
