#!/bin/bash

# Extract the args or use defaults
LEDGER_CANISTER_ID=$1

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Update SNS1 token to be called Dragginz in the Registry"
SUMMARY="Update the SNS1 token name to Dragginz, the symbol to DKP, and the info_url to https://dragginz.io"

# update_token args
ARGS="(record {
    ledger_canister_id=principal \"$LEDGER_CANISTER_ID\";
    name=\"Dragginz\";
    symbol=\"DKP\";
    info_url=\"https://dragginz.io\";
})"

FUNCTION_ID=7001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
