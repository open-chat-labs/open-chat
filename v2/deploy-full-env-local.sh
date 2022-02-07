#!/bin/sh

# Deploys everything needed to test OpenChat locally (OpenChat, InternetIdentity and OpenStorage)

IDENTITY=$1
INTERNET_IDENTITY_DIR=$2
OPEN_STORAGE_DIR=$3

# Deploy the Internet Identity service
pushd $INTERNET_IDENTITY_DIR
rm -r .dfx/local
II_ENV=development dfx deploy --no-wallet --argument '(null)'
popd

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create user_index
dfx --identity $IDENTITY canister create group_index
dfx --identity $IDENTITY canister create notifications
dfx --identity $IDENTITY canister create online_users_aggregator
USER_INDEX_CANISTER_ID=$(dfx canister id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister id group_index)

# Create the OpenStorage index canister
pushd $OPEN_STORAGE_DIR
rm -r .dfx/local
dfx --identity $IDENTITY canister create index
OPEN_STORAGE_INDEX_CANISTER_ID=$(dfx canister id index)

# Deploy OpenStorage canisters
./deploy-local.sh $IDENTITY

# Add user_index and group_index as OpenStorage service principals
dfx --identity=$IDENTITY canister call index add_service_principals "(record { principals=vec { principal \"$USER_INDEX_CANISTER_ID\"; principal \"$GROUP_INDEX_CANISTER_ID\" } })"
popd

# Deploy OpenChat canisters
./deploy-local.sh $IDENTITY $OPEN_STORAGE_INDEX_CANISTER_ID
