#!/bin/sh

CANISTER=$1
TITLE=$2
URL=$3
SUMMARY=$4

echo "Register $CANISTER with SNS"

CANISTER_ID=$(dfx -qq canister --network $NETWORK id $CANISTER)

PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {RegisterDappCanisters = record {canister_ids=vec {principal \"$CANISTER_ID\"}}}})"
CANISTER_IDS_FILE='../../'"$NETWORK"'_sns_canister_ids.json'

quill sns --canister-ids-file $CANISTER_IDS_FILE --pem-file $PEM_FILE make-proposal --proposal "$PROPOSAL" $DEVELOPER_NEURON_ID > msg.txt
quill send --yes msg.txt
rm -f msg.txt
