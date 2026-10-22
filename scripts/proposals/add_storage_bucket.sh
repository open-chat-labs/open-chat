#!/bin/bash

# The StorageIndex pays the CMC in cycles to create the bucket, from its own balance.

# Extract the args or use defaults
SUBNET_ID=$1
SUMMARY=${2:-"Each image, video and file uploaded to OpenChat is stored in a storage bucket canister, so by adding more bucket canisters we increase the total available storage volume and spread the load across more canisters."}

# Subnet ids are 63 characters long, which rules out passing a canister id by mistake
if [ ${#SUBNET_ID} -ne 63 ]; then
    echo "Usage: $0 <subnet_id> [summary]"
    exit 1
fi

# Build the title
TITLE="Add a new storage bucket on subnet $SUBNET_ID"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_bucket_canister args
ARGS="(record { subnet_id=opt principal \"$SUBNET_ID\" })"
FUNCTION_ID=5001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
