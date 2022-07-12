#!/bin/sh

# Pass in the dfx identity name and the OpenStorage index canisterId
# eg './deploy-local.sh default rturd-qaaaa-aaaaf-aabaq-cai'

IDENTITY=$1
OPEN_STORAGE_INDEX_CANISTER_ID=$2

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 root
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 online_users_aggregator
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 callback
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 proposals_bot

MINT_ACC=$(dfx --identity $IDENTITY ledger account-id)
dfx --identity $IDENTITY deploy --no-wallet --with-cycles 100000000000000 ledger --argument '(record {minting_account = "'${MINT_ACC}'"; initial_values = vec {}; send_whitelist = vec {}})'

LEDGER_CANISTER_ID=$(dfx canister id ledger)

./scripts/deploy.sh local http://127.0.0.1:8000/ $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID $LEDGER_CANISTER_ID true