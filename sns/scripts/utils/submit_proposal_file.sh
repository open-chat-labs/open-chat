#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Extract the proposal path
PROPOSAL_PATH=$1

# Make the proposal using quill
quill sns --canister-ids-file ./sns_canister_ids.json --pem-file $PEM_FILE make-proposal --proposal-path "$PROPOSAL_PATH" $PROPOSER_NEURON_ID > msg.json
quill send msg.json
rm -f msg.json
