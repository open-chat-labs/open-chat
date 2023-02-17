#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

CANISTER=$1
TITLE=$2
URL=$3
SUMMARY=$4

echo "Register $CANISTER with SNS"

CANISTER_ID=$(dfx -qq canister --network $NETWORK id $CANISTER)

PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {RegisterDappCanisters = record {canister_ids=vec {principal \"$CANISTER_ID\"}}}})"

../utils/submit_proposal.sh "$PROPOSAL"
