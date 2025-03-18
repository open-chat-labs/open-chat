#!/bin/bash

# Extract the args or use defaults
TOKEN_NAME=$1
LEDGER_CANISTER_ID=$2
TOKEN_STANDARD=$3
INFO_URL=$4
TRANSACTION_URL_FORMAT=$5

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Add $TOKEN_NAME token to the Registry"
SUMMARY="The Registry is not currently in use. But once it is enabled, only those tokens stored in the Registry will be able to be transferred within OpenChat."

# add_token args
ARGS="(record {
    ledger_canister_id=principal \"$LEDGER_CANISTER_ID\";
    token_standard=variant { \"$TOKEN_STANDARD\" };
    info_url=\"$INFO_URL\";
    transaction_url_format=\"$TRANSACTION_URL_FORMAT\";
})"

FUNCTION_ID=7000

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
