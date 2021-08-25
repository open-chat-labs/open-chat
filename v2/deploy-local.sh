#!/bin/sh

# Pass in the dfx identity name
# eg './deploy-local openchat'

./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl

dfx --identity $1 canister --no-wallet create user_index
dfx --identity $1 canister --no-wallet create group_index
dfx --identity $1 canister --no-wallet create notifications

user_index_canister_id=$(dfx canister --no-wallet id user_index)
group_index_canister_id=$(dfx canister --no-wallet id group_index)
notifications_index_canister_id=$(dfx canister --no-wallet id notifications)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  'http://127.0.0.1:8000/' \
  $1 \
  $user_index_canister_id \
  $group_index_canister_id \
  $notifications_index_canister_id