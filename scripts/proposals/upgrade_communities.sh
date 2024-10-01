#!/bin/bash

VERSION=$1
CHANGELOG_PATH=$2
DFX_IDENTITY=${3:-default}

TITLE="Upgrade Community canisters to $VERSION"
CHANGELOG=`cat $CHANGELOG_PATH`
FUNCTION_ID=2005
CANISTER_NAME=community

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Submit the proposal
./make_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER_NAME "$VERSION" "$TITLE" "$CHANGELOG" true $DFX_IDENTITY
