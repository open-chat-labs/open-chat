#!/bin/sh

# Pass in network name, IC url, identity name, OpenStorage index canisterId, Ledger canisterId, and test mode (true/false)
# eg './deploy.sh ic https://ic0.app/ openchat rturd-qaaaa-aaaaf-aabaq-cai ryjl3-tyaaa-aaaaa-aaaba-cai false'

NETWORK=$1
IC_URL=$2
IDENTITY=$3
OPEN_STORAGE_INDEX_CANISTER_ID=$4
LEDGER_CANISTER_ID=$5
TEST_MODE=$6

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/generate-wasm.sh callback_canister_impl
./scripts/generate-wasm.sh group_canister_impl
./scripts/generate-wasm.sh group_index_canister_impl
./scripts/generate-wasm.sh notifications_canister_impl
./scripts/generate-wasm.sh online_users_aggregator_canister_impl
./scripts/generate-wasm.sh proposals_bot_canister_impl
./scripts/generate-wasm.sh user_canister_impl
./scripts/generate-wasm.sh user_index_canister_impl

USER_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id notifications)
ONLINE_USERS_AGGREGATOR_CANISTER_ID=$(dfx canister --network $NETWORK id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister --network $NETWORK id callback)
PROPOSALS_BOT_CANISTER_ID=$(dfx canister --network $NETWORK id proposals_bot)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  $IC_URL \
  $TEST_MODE \
  $IDENTITY \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR_CANISTER_ID \
  $CALLBACK_CANISTER_ID \
  $PROPOSALS_BOT_CANISTER_ID \
  $OPEN_STORAGE_INDEX_CANISTER_ID \
  $LEDGER_CANISTER_ID
