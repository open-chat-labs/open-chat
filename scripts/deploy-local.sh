#!/bin/sh

# Deploys everything needed to test OpenChat locally (OpenChat, OpenStorage and the NNS canisters)

IDENTITY=${1:-default}

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Create and install the NNS canisters
dfx --identity $IDENTITY nns install
LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 online_users_aggregator
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 callback
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 proposals_bot
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 open_storage_index

# Install the OpenChat canisters
./scripts/deploy.sh local http://127.0.0.1:8080/ $IDENTITY $LEDGER_CANISTER_ID true
