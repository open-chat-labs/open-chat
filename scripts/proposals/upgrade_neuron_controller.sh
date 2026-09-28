#!/bin/bash

VERSION=$1

TITLE="Upgrade NeuronController canister to $VERSION"
FUNCTION_ID=3
CANISTER_NAME=neuron_controller

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Submit the proposal
./make_upgrade_canister_proposal.sh $FUNCTION_ID $CANISTER_NAME "$VERSION" "$TITLE"
