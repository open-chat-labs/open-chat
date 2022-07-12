#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Pass in the dfx identity name
# eg './upgrade-canister-prod.sh openchat user_index 1.0.0'

IDENTITY=$1
CANISTER_TO_UPGRADE=$2
VERSION=$3

./scripts/generate-wasm.sh ${CANISTER_TO_UPGRADE}_canister_impl

ROOT_CANISTER_ID=$(dfx canister --network ic id root)
USER_INDEX_CANISTER_ID=$(dfx canister --network ic id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network ic id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network ic id notifications)
ONLINE_USERS_AGGREGATOR=$(dfx canister --network ic id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister --network ic id callback)
PROPOSALS_BOT_CANISTER_ID=$(dfx canister --network ic id proposals_bot)

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
  $PROPOSALS_BOT_CANISTER_ID \
  $CANISTER_TO_UPGRADE \
  $VERSION \