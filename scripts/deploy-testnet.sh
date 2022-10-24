#!/bin/sh

# Deploys everything needed to test OpenChat locally (OpenChat, OpenStorage and the NNS canisters)

NETWORK=$1
IC_URL=$2
IDENTITY=${3:-default}

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 online_users_aggregator
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 callback
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 proposals_bot
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 cycles_dispenser
dfx --identity $IDENTITY canister create --network $NETWORK --no-wallet --with-cycles 100000000000000 open_storage_index
OPEN_STORAGE_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id open_storage_index)

# Install the OpenChat canisters
./scripts/deploy.sh $NETWORK $IC_URL $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID $LEDGER_CANISTER_ID true
