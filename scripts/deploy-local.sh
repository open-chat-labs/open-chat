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
USER_INDEX_CANISTER_ID=$(dfx canister id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister id group_index)
OPEN_STORAGE_INDEX_CANISTER_ID=$(dfx canister id open_storage_index)

# Install the OpenChat canisters
./scripts/deploy.sh local http://127.0.0.1:8080/ $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID $LEDGER_CANISTER_ID true

# Send the first user 10 ICP
pushd frontend
npm run mint_test_icp 2f3bc10b71600f18d656ed1b51d87634c400dab244088245d9923216a10bf2e8 1000000000
popd
