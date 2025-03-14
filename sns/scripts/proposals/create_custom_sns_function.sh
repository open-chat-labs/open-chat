#!/bin/bash

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

TITLE=$1
URL=$2
SUMMARY=$3
FUNCTION_ID=$4
FUNCTION_NAME=$5
FUNCTION_DESC=$6
TOPIC=$7
TARGET_CANISTER_ID=$8
TARGET_NAME=$9
VALIDATOR_CANISTER_ID=${10}
VALIDATOR_NAME=${11}

echo "Create custom SNS function $FUNCTION_ID"
echo "TOPIC $TOPIC"

PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {AddGenericNervousSystemFunction = record {id=($FUNCTION_ID:nat64); name=\"$FUNCTION_NAME\"; description=opt\"$FUNCTION_DESC\"; function_type=opt variant {GenericNervousSystemFunction=record{validator_canister_id=opt principal\"$VALIDATOR_CANISTER_ID\"; target_canister_id=opt principal\"$TARGET_CANISTER_ID\"; validator_method_name=opt\"$VALIDATOR_NAME\"; target_method_name=opt\"$TARGET_NAME\"; topic=opt variant { \"$TOPIC\" }}}}}})"

../utils/submit_proposal.sh "$PROPOSAL"
