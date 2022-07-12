#!/bin/sh

# Pass in the dfx identity name
# eg './upgrade-canister.sh openchat user_index 1.0.0'

NETWORK=$1
IC_URL=$2
IDENTITY=$3
CANISTER_NAME=$4
VERSION=$5

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/generate-wasm.sh ${CANISTER_NAME}_canister_impl

ROOT_CANISTER_ID=$(dfx canister --network $NETWORK id root)
USER_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id notifications)
ONLINE_USERS_AGGREGATOR_CANISTER_ID=$(dfx canister --network $NETWORK id online_users_aggregator)
CALLBACK_CANISTER_ID=$(dfx canister --network $NETWORK id callback)
PROPOSALS_BOT_CANISTER_ID=$(dfx canister --network $NETWORK id proposals_bot)

cargo run \
  --manifest-path backend/canister_upgrader/Cargo.toml \
  $IC_URL \
  $IDENTITY \
  $ROOT_CANISTER_ID \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $ONLINE_USERS_AGGREGATOR_CANISTER_ID \
  $CALLBACK_CANISTER_ID \
  $PROPOSALS_BOT_CANISTER_ID \
  $CANISTER_NAME \
  $VERSION \