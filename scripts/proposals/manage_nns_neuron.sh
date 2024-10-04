#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Increase the dissolve delay of NNS neuron 15574844586067538603 to 6 months"
SUMMARY="This will instruct the NeuronController canister to call 'manage_neuron' on the NNS governance canister, increasing the dissolve delay of neuron 15574844586067538603 to 6 months."
URL="https://dashboard.internetcomputer.org/neuron/15574844586067538603"
ARGS="(record { neuron_id = 15574844586067538603:nat64; command = variant { Configure = record { operation = opt variant { IncreaseDissolveDelay = record { additional_dissolve_delay_seconds = 15778800:nat32 } } } } })"
FUNCTION_ID=8001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"

# -- Manage neuron commands --

# Add Hotkey
# ARGS="(record { neuron_id = 17682165960669268263:nat64; command = variant { Configure = record { operation = opt variant { AddHotKey = record { new_hot_key = principal \"tktqu-nyaaa-aaaar-qackq-cai\" } } } } })"

# Follow
# ARGS="(record { neuron_id = 15574844586067538603:nat64; command = variant { Follow = record { topic = 14:int32; followees = vec { record { id = 17682165960669268263:nat64 } } } } })"

# Increase Dissolve Delay
# ARGS="(record { neuron_id = 15574844586067538603:nat64; command = variant { Configure = record { operation = opt variant { IncreaseDissolveDelay = record { additional_dissolve_delay_seconds = 15778800:nat32 } } } } })"

# Split
# ARGS="(record { neuron_id = 15574844586067538603:nat64; command = variant { Split = record { amount_e8s = 10000000000000:nat64 } } })"
