#!/bin/bash

# Extract the args or use defaults
SUBNET_ID=$1
SUBNET_ID_SHORT=${SUBNET_ID:0:5}
SUMMARY="This proposal will instruct the Registry canister to expand OpenChat onto subnet [$SUBNET_ID_SHORT](https://dashboard.internetcomputer.org/subnet/$SUBNET_ID), allowing it to scale to many more users, groups and communities."

# Build the title
TITLE="Expand OpenChat onto a new subnet"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_canister args
ARGS="(record { subnet_id=principal \"$SUBNET_ID\" })"
FUNCTION_ID=7002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
