#!/bin/bash

# Extract the args or use defaults
CANISTER_ID=$1
SUMMARY=${2:-"Each image, video and file uploaded to OpenChat is stored in a storage bucket canister, so by adding more bucket canisters we increase the total available storage volume and spread the load across more canisters."}

# Build the title
TITLE="Add canister $CANISTER_ID as a new storage bucket"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_platform_moderator args
ARGS="(record { canister_id=principal \"$CANISTER_ID\" })"
FUNCTION_ID=5001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
