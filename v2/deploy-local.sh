#!/bin/sh

IDENTITY=$1
TEST_MODE=true

# Pass in the dfx identity name
# eg './deploy-local openchat'
./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh online_users_aggregator_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl

./compress-wasm.sh group_canister_impl
./compress-wasm.sh user_canister_impl

dfx --identity $IDENTITY canister --no-wallet create user_index
dfx --identity $IDENTITY canister --no-wallet create group_index
dfx --identity $IDENTITY canister --no-wallet create notifications
dfx --identity $IDENTITY canister --no-wallet create online_users_agg

USER_INDEX_CANISTER_ID=$(dfx canister --no-wallet id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --no-wallet id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --no-wallet id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister --no-wallet id online_users_aggregator)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  'http://127.0.0.1:8000/' \
  $TEST_MODE \
  $IDENTITY \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR \