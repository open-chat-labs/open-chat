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

ARGS="(record { subaccount=blob \"$SUBACCOUNT\"; command=opt variant { MakeProposal=$PROPOSAL } })"

# Show the message and ask for confirmation before sending it, as quill does. If didc is available, round trip the
# args through the SNS governance candid so they are shown formatted, exactly as the canister will receive them
echo "Sending message with"
echo
echo "  Identity:    $IDENTITY ($(dfx identity get-principal --identity $IDENTITY))"
echo "  Canister:    sns_governance ($NETWORK)"
echo "  Method name: manage_neuron"
if command -v didc > /dev/null
then
  CANDID=../../candid/sns_governance.did
  ENCODED=$(didc encode -d $CANDID -m manage_neuron "$ARGS") || exit 1
  echo "  Arguments:   $(didc decode -d $CANDID -t "(ManageNeuron)" "$ENCODED")"
else
  echo "  Arguments:   $ARGS"
fi
echo

read -r -p "Do you want to send this message? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]
then
  echo "Not sent"
  exit 0
fi

dfx canister --identity $IDENTITY --network $NETWORK call sns_governance manage_neuron "$ARGS"
