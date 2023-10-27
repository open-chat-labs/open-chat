#!/bin/sh

VERSION=$1
SUMMARY_PATH=$2

TITLE="Upgrade Group canisters to $VERSION"
SUMMARY=`cat $SUMMARY_PATH`
FUNCTION_ID=2001
CANISTER_NAME=group

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Submit the proposal
./make_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER_NAME "$VERSION" "$TITLE" "$SUMMARY"
