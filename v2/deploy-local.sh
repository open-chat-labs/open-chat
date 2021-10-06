#!/bin/sh

IDENTITY=$1

# Pass in the dfx identity name
# eg './deploy-local openchat'
./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl

./compress-wasm.sh group_index_canister_impl
./compress-wasm.sh user_canister_impl

dfx --identity $IDENTITY canister --no-wallet create user_index
dfx --identity $IDENTITY canister --no-wallet create group_index
dfx --identity $IDENTITY canister --no-wallet create notifications

USER_INDEX_CANISTER_ID=$(dfx canister --no-wallet id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --no-wallet id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --no-wallet id notifications)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  'http://127.0.0.1:8000/' \
  $IDENTITY \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID