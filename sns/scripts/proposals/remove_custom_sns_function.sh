#!/bin/bash

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport; source ../.env; set +o allexport
../utils/setup_env.sh

FUNCTION_NAME=$1
URL=$2
SUMMARY=$3
FUNCTION_ID=$4

TITLE="Remove custom SNS function \\\"$FUNCTION_NAME\\\""

PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {RemoveGenericNervousSystemFunction = $FUNCTION_ID:nat64}})"

../utils/submit_proposal.sh "$PROPOSAL"

../utils/cleanup_env.sh
