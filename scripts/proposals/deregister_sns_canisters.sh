#!/bin/bash

# cd into the scripts folder
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Extract the args
TITLE=$1
CANISTER_ID=$2
NEW_CONTROLLER=$3
SUMMARY_PATH=$4

SUMMARY=`cat $SUMMARY_PATH`

# Build the proposal candid
PROPOSAL="(record { title=\"$TITLE\"; url=\"\"; summary=\"$SUMMARY\"; action=opt variant { DeregisterDappCanisters = record { canister_ids = vec { principal \"$CANISTER_ID\" }; new_controllers = vec { principal \"$NEW_CONTROLLER\" }}}})"

# Make the proposal
./make_proposal.sh "$PROPOSAL"
