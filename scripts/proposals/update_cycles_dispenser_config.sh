#!/bin/sh

TITLE="Update CyclesDispenser config"
SUMMARY="Set the min cycles balance to 1000T and set the ICP burn amount to 50 ICP.

This means that each time the canister's cycles balance drops below 1000T it will burn 50 ICP into cycles.

You can see the configuration settings (and general metrics) for the CyclesDispenser [here](https://gonut-hqaaa-aaaaf-aby7a-cai.raw.ic0.app/metrics)"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

ARGS="(record { min_cycles_balance=opt 1000000000000000:opt nat; icp_burn_amount=opt record { e8s=5000000000:nat64 } })"
FUNCTION_ID=6001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
