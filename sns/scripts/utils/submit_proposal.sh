#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Extract the proposal
PROPOSAL=$1

# Make the proposal using quill
quill sns --canister-ids-file ./sns_canister_ids.json --pem-file $PEM_FILE make-proposal --proposal "$PROPOSAL" $DEVELOPER_NEURON_ID > msg.json

if ["$YES_TO_PROPOSALS" = true] ; then
    quill send --yes msg.json
else
    quill send msg.json
fi

rm -f msg.json
