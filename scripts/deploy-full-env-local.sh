#!/bin/sh

# Deploys everything needed to test OpenChat locally (OpenChat, InternetIdentity, OpenStorage and Ledger)

IDENTITY=$1
INTERNET_IDENTITY_DIR=$2

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Deploy the Internet Identity service
pushd $INTERNET_IDENTITY_DIR
rm -r .dfx/local
# II_ENV=development dfx deploy --no-wallet --argument '(null)'
II_DUMMY_AUTH=1 II_DUMMY_CAPTCHA=1 II_FETCH_ROOT_KEY=1 dfx deploy --no-wallet --argument '(null)'
popd

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 ledger
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

# Deploy OpenChat canisters
./scripts/deploy-local.sh $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID

# Send the first user 10 ICP
dfx --identity $IDENTITY canister call ledger send_dfx '(record { memo = 0; amount = record { e8s = 1000000000 }; fee = record { e8s = 0 }; to = "782a6c522af8cb950f239389874b9b1bf71a5ac8bb6d587f955254d9c9358fc8" })'
