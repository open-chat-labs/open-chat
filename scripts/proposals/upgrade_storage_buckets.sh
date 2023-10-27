#!/bin/sh

VERSION=$1
SUMMARY_PATH=$2

TITLE="Upgrade StorageBucket canisters to $VERSION"
SUMMARY=`cat $SUMMARY_PATH`
FUNCTION_ID=5003
CANISTER_NAME=storage_bucket

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Submit the proposal
./make_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER_NAME "$VERSION" "$TITLE" "$SUMMARY"
