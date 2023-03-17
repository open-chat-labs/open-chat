#!/bin/sh

# Extract the args
TITLE=$1
URL=$2
SUMMARY_PATH=$3

SUMMARY=$(cat $SUMMARY_PATH)

TOKEN=$4
TO_PRINCIPAL=$5
TO_SUBACCOUNT=$6
MEMO=$7
AMOUNT_E8S=$8

if [ $TOKEN = "ICP" ]
then
    TREASURY=1
elif [ $TOKEN = "CHAT" ]
then
    TREASURY=2
else
    echo "TOKEN not set"
    exit 1
fi

# Set current directory to the OC root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/../..

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./sns/scripts/utils/setup_env.sh

# Build the proposal candid
PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {
TransferSnsTreasuryFunds = record {
    from_treasury=$TREASURY:int32;
    to_principal=opt principal \"$TO_PRINCIPAL\": opt principal;
    to_subaccount=opt record { subaccount = vec { $TO_SUBACCOUNT };
    memo=$MEMO: opt nat64;
    amount_e8s=$AMOUNT_E8S: nat64;
}}})"

# Submit the proposal
./sns/scripts/utils/submit_proposal.sh "$PROPOSAL"

# Cleanup
./sns/scripts/utils/cleanup_env.sh
