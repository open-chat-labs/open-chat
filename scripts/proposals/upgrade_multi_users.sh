#!/bin/bash

VERSION=$1
DFX_IDENTITY=${2:-default}

TITLE="Upgrade MultiUser canisters to $VERSION"
FUNCTION_ID=1016
CANISTER_NAME=multi_user

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Submit the proposal
./make_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER_NAME "$VERSION" "$TITLE" true $DFX_IDENTITY
