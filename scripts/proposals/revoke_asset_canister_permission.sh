#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Revoke the permission previously granted to the OpenChat dev team to commit new frontend asset batches"
SUMMARY="Currently, new frontend asset batches can be commited by either the OpenChat governance canister or by the OpenChat dev team principal (tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae).

The OpenChat dev team was originally granted this permission when the OpenChat SNS launched, because at that time it was not possible to commit these batches via proposal.

This functionality has subsequently been implemented, so the OpenChat dev team should now have their permission revoked so that frontend updates can only be committed via proposal."

ARGS="(record { permission = variant { Commit }; of_principal = principal \"tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae\" })"
FUNCTION_ID=10002

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
