#!/bin/sh

WASM_SRC=$1
VERSION=$2
TITLE=$3
URL=$4
SUMMARY_PATH=$5

SUMMARY=`cat $SUMMARY_PATH`

FUNCTION_ID=1001
CANISTER=user

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Submit the proposal
../make_custom_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER $WASM_SRC "$VERSION" "$TITLE" "$URL" "$SUMMARY"
