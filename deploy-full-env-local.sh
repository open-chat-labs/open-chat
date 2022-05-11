#!/bin/sh

# Deploys everything needed to test OpenChat locally (OpenChat, InternetIdentity and OpenStorage)

IDENTITY=$1
INTERNET_IDENTITY_DIR=$2
OPEN_STORAGE_DIR=$3
TRANSACTION_NOTIFIER_DIR=$4

# Deploy the Internet Identity service
pushd $INTERNET_IDENTITY_DIR
rm -r .dfx/local
II_FETCH_ROOT_KEY=1 dfx deploy --no-wallet --argument '(null)'
popd

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 ledger
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 root
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 online_users_aggregator
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 callback
LEDGER_CANISTER_ID=$(dfx canister id ledger)
USER_INDEX_CANISTER_ID=$(dfx canister id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister id group_index)

# OpenStorage
pushd $OPEN_STORAGE_DIR
rm -r .dfx/local
# Create the OpenStorage index canister
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 index
OPEN_STORAGE_INDEX_CANISTER_ID=$(dfx canister id index)

# Deploy OpenStorage canisters
./deploy-local.sh $IDENTITY

# Add user_index and group_index as OpenStorage service principals
dfx --identity=$IDENTITY canister call index add_service_principals "(record { principals=vec { principal \"$USER_INDEX_CANISTER_ID\"; principal \"$GROUP_INDEX_CANISTER_ID\" } })"
popd

# TransactionNotifier
pushd $TRANSACTION_NOTIFIER_DIR
rm -r .dfx/local
# Create TransactionNotifier canister
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 transaction_notifier
TRANSACTION_NOTIFIER_CANISTER_ID=$(dfx canister id transaction_notifier)

# Deploy TransactionNotifier canister
./deploy-local.sh $IDENTITY $USER_INDEX_CANISTER_ID
popd

# Deploy OpenChat canisters
./deploy-local.sh $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID $TRANSACTION_NOTIFIER_CANISTER_ID

dfx --identity $IDENTITY canister call user_index add_token "(record { ledger_canister_id = principal \"$LEDGER_CANISTER_ID\"; enable_sync = true })"