#!/bin/sh

# Pass in the dfx identity name
# eg './upgrade-canister-local openchat user_index 1.0.0'

IDENTITY=$1
CANISTER_TO_UPGRADE=$2
VERSION=$3

./generate-wasm.sh ${CANISTER_TO_UPGRADE}_canister_impl

./compress-wasm.sh group_canister_impl
./compress-wasm.sh user_canister_impl
./compress-wasm.sh user_index_canister_impl

ROOT_CANISTER_ID=$(dfx canister id root)
USER_INDEX_CANISTER_ID=$(dfx canister id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister id callback)

cargo run \
  --manifest-path backend/canister_upgrader/Cargo.toml \
  'http://127.0.0.1:8000/' \
  $IDENTITY \
  $ROOT_CANISTER_ID \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR \
  $CALLBACK_CANISTER_ID \
  $CANISTER_TO_UPGRADE \
  $VERSION \