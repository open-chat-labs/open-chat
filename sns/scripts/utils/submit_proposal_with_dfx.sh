#!/bin/bash

# Submits a proposal using dfx rather than quill. Use this for proposals containing fields which quill can't
# encode, eg. quill (as of v0.5.4) silently drops the `topic` of an AddGenericNervousSystemFunction proposal,
# which SNS governance then rejects with "NervousSystemFunction must have a topic".

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Extract the proposal (a candid record, not wrapped in parentheses)
PROPOSAL=$1

# The neuron's subaccount is the neuron id, formatted as a candid blob
SUBACCOUNT=$(echo $PROPOSER_NEURON_ID | sed 's/../\\&/g')

dfx canister --identity $IDENTITY --network $NETWORK call sns_governance manage_neuron "(record { subaccount=blob \"$SUBACCOUNT\"; command=opt variant { MakeProposal=$PROPOSAL } })"
