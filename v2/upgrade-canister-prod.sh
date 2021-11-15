#!/bin/sh

IDENTITY=$1
CANISTER_TO_UPGRADE=$2
VERSION=$3

# Pass in the dfx identity name
# eg './upgrade-canister-prod.sh openchat user_index 1.0.0'
./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh online_users_aggregator_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl

./compress-wasm.sh group_canister_impl
./compress-wasm.sh user_canister_impl

USER_INDEX_CANISTER_ID=$(dfx canister --network ic --no-wallet id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network ic --no-wallet id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network ic --no-wallet id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister --network ic --no-wallet id online_users_aggregator)

cargo run \
  --manifest-path backend/canister_upgrader/Cargo.toml \
  'https://ic0.app/' \
  $IDENTITY \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR \
  $CANISTER_TO_UPGRADE \
  $VERSION \