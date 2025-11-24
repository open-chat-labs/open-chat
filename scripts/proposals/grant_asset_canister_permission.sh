#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Grant the OpenChat dev team permission to prepare frontend asset batches"
SUMMARY="This will grant the OpenChat dev team principal (tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae) permission to prepare frontend asset batches by uploading assets to the [OpenChat frontend assets canister](https://dashboard.internetcomputer.org/canister/6hsbt-vqaaa-aaaaf-aaafq-cai)."

# add_canister args
ARGS="(record { permission = variant { Prepare }; to_principal = principal \"tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae\" })"
FUNCTION_ID=10001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
