#!/bin/sh

IDENTITY=$1
OPEN_STORAGE_INDEX_CANISTER_ID=$2
TRANSACTION_NOTIFIER_CANISTER_ID=$3

# Pass in the dfx identity name and the OpenStorage index canisterId
# eg './deploy-prod-test.sh openchat 6jemw-paaaa-aaaaf-ab2ea-cai'
./generate-wasm.sh callback_canister_impl
./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh online_users_aggregator_canister_impl
./generate-wasm.sh root_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl

./compress-wasm.sh group_canister_impl
./compress-wasm.sh user_canister_impl

ROOT_CANISTER_ID=$(dfx canister --network ic_test id root)
USER_INDEX_CANISTER_ID=$(dfx canister --network ic_test id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network ic_test id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network ic_test id notifications)
ONLINE_USERS_AGGREGATOR_CANISTER_ID=$(dfx canister --network ic_test id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister --network ic_test id callback)
LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  'https://ic0.app/' \
  true \
  $IDENTITY \
  $ROOT_CANISTER_ID \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR_CANISTER_ID \
  $CALLBACK_CANISTER_ID \
  $OPEN_STORAGE_INDEX_CANISTER_ID \
  $TRANSACTION_NOTIFIER_CANISTER_ID \
  $LEDGER_CANISTER_ID \
