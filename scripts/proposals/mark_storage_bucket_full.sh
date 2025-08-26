#!/bin/bash

# Extract the args or use defaults
CANISTER_ID=$1
SUMMARY=${2:-"Once a storage bucket canister is marked as full it will no longer be used to store new files, but will continue serving existing files."}

# Build the title
TITLE="Mark storage bucket $CANISTER_ID as full"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_platform_moderator args
ARGS="(record { bucket=principal \"$CANISTER_ID\"; full=true })"
FUNCTION_ID=5002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
