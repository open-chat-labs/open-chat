#!/bin/sh

IDENTITY=$1
CANISTER_TO_UPGRADE=$2
VERSION=${3:-0.0.0}

# Pass in the dfx identity name
# eg './deploy-local openchat'
./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl

./compress-wasm.sh group_canister_impl
./compress-wasm.sh user_canister_impl

USER_INDEX_CANISTER_ID=$(dfx canister --no-wallet id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --no-wallet id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --no-wallet id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister --no-wallet id online_users_agg)

cargo run \
  --manifest-path backend/canister_upgrader/Cargo.toml \
  'http://127.0.0.1:8000/' \
  $IDENTITY \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR \
  $CANISTER_TO_UPGRADE \
  $VERSION \