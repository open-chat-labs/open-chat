#!/bin/sh

# Deploys everything needed to test OpenChat locally (OpenChat, InternetIdentity and OpenStorage)

IDENTITY=$1
INTERNET_IDENTITY_DIR=$2
OPEN_STORAGE_DIR=$3

# Deploy the Internet Identity service
pushd $INTERNET_IDENTITY_DIR
rm -r .dfx/local
# II_ENV=development dfx deploy --no-wallet --argument '(null)'
II_FETCH_ROOT_KEY=1 dfx deploy --no-wallet --argument '(null)'
popd

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 root
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 online_users_aggregator
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 callback
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 ledger
USER_INDEX_CANISTER_ID=$(dfx canister id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister id group_index)

# Create the OpenStorage index canister
pushd $OPEN_STORAGE_DIR
rm -r .dfx/local
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 index
OPEN_STORAGE_INDEX_CANISTER_ID=$(dfx canister id index)

# Deploy OpenStorage canisters
./deploy-local.sh $IDENTITY

# Add user_index and group_index as OpenStorage service principals
dfx --identity=$IDENTITY canister call index add_service_principals "(record { principals=vec { principal \"$USER_INDEX_CANISTER_ID\"; principal \"$GROUP_INDEX_CANISTER_ID\" } })"
popd

# Deploy OpenChat canisters
./deploy-local.sh $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID

# Send the first user 10 ICP
dfx --identity $IDENTITY canister call ledger send_dfx '(record { memo = 0; amount = record { e8s = 1000000000 }; fee = record { e8s = 0 }; to = "782a6c522af8cb950f239389874b9b1bf71a5ac8bb6d587f955254d9c9358fc8" })'
