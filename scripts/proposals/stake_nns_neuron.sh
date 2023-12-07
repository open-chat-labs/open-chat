#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Instruct the NeuronController canister to stake a new NNS neuron"
SUMMARY="This will instruct the NeuronController canister to stake a new neuron with a stake of 1 ICP."
URL=""
ARGS="(record {})"
FUNCTION_ID=8000

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
