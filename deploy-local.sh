#!/bin/sh

IDENTITY=$1
TEST_MODE=true
OPEN_STORAGE_INDEX_CANISTER_ID=$2

# Pass in the dfx identity name and the OpenStorage index canisterId
# eg './deploy-local openchat rturd-qaaaa-aaaaf-aabaq-cai'
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

dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 root
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 online_users_aggregator
dfx --identity $IDENTITY canister create --no-wallet --with-cycles 100000000000000 callback

MINT_ACC=$(dfx --identity $IDENTITY ledger account-id)
dfx --identity $IDENTITY deploy --no-wallet --with-cycles 100000000000000 ledger --argument '(record {minting_account = "'${MINT_ACC}'"; initial_values = vec {}; send_whitelist = vec {}})'

ROOT_CANISTER_ID=$(dfx canister id root)
USER_INDEX_CANISTER_ID=$(dfx canister id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister id callback)
LEDGER_CANISTER_ID=$(dfx canister id ledger)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  'http://127.0.0.1:8000/' \
  $TEST_MODE \
  $IDENTITY \
  $ROOT_CANISTER_ID \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR \
  $CALLBACK_CANISTER_ID \
  $OPEN_STORAGE_INDEX_CANISTER_ID \
  $LEDGER_CANISTER_ID \
