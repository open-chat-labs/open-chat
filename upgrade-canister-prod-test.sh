#!/bin/sh

# Pass in the dfx identity name
# eg './upgrade-canister-prod-test.sh openchat user_index 1.0.0'

IDENTITY=$1
CANISTER_TO_UPGRADE=$2
VERSION=$3

./generate-wasm.sh ${CANISTER_TO_UPGRADE}_canister_impl

./compress-wasm.sh group_canister_impl
./compress-wasm.sh user_canister_impl
./compress-wasm.sh user_index_canister_impl

ROOT_CANISTER_ID=$(dfx canister --network ic_test id root)
USER_INDEX_CANISTER_ID=$(dfx canister --network ic_test id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network ic_test id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network ic_test id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister --network ic_test id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister --network ic_test id callback)

cargo run \
  --manifest-path backend/canister_upgrader/Cargo.toml \
  'https://ic0.app/' \
  $IDENTITY \
  $ROOT_CANISTER_ID \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR \
  $CALLBACK_CANISTER_ID \
  $CANISTER_TO_UPGRADE \
  $VERSION \