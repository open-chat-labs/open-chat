#!/bin/bash

VERSION=$1
CHANGELOG_PATH=$2

TITLE="Upgrade EventRelay canister to $VERSION"
CHANGELOG=`cat $CHANGELOG_PATH`
FUNCTION_ID=3
CANISTER_NAME=event_relay

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Submit the proposal
./make_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER_NAME "$VERSION" "$TITLE" "$CHANGELOG"
