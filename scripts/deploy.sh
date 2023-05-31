#!/bin/sh

# Pass in network name, IC url, identity name, Governance canisterId, Ledger canisterId, CMC canisterId, and test mode (true/false)
# eg './deploy.sh ic https://ic0.app/ openchat rrkah-fqaaa-aaaaa-aaaaq-cai ryjl3-tyaaa-aaaaa-aaaba-cai rkp4c-7iaaa-aaaaa-aaaca-cai false'

NETWORK=$1
IC_URL=$2
IDENTITY=$3
WASM_SRC=$4 # WASM_SRC is either empty, "build", "latest", "local", prod" or the commit Id
NNS_GOVERNANCE_CANISTER_ID=$5
NNS_INTERNET_IDENTITY_CANISTER_ID=$6
NNS_LEDGER_CANISTER_ID=$7
NNS_CMC_CANISTER_ID=$8
TEST_MODE=$9

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if [ $WASM_SRC = "build" ]
then
    ./scripts/generate-all-canister-wasms.sh
elif [ $WASM_SRC != "local" ]
then
    ./scripts/download-all-canister-wasms.sh $WASM_SRC || exit 1
fi

USER_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id notifications_index)
LOCAL_USER_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id local_user_index)
LOCAL_GROUP_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id local_group_index)
NOTIFICATIONS_CANISTER_ID=$(dfx canister --network $NETWORK id notifications)
ONLINE_USERS_CANISTER_ID=$(dfx canister --network $NETWORK id online_users)
PROPOSALS_BOT_CANISTER_ID=$(dfx canister --network $NETWORK id proposals_bot)
STORAGE_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id storage_index)
CYCLES_DISPENSER_CANISTER_ID=$(dfx canister --network $NETWORK id cycles_dispenser)
MARKET_MAKER_CANISTER_ID=$(dfx canister --network $NETWORK id market_maker)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml \
  $IC_URL \
  $TEST_MODE \
  $IDENTITY \
  $USER_INDEX_CANISTER_ID \
  $GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_INDEX_CANISTER_ID \
  $LOCAL_USER_INDEX_CANISTER_ID \
  $LOCAL_GROUP_INDEX_CANISTER_ID \
  $NOTIFICATIONS_CANISTER_ID \
  $ONLINE_USERS_CANISTER_ID \
  $PROPOSALS_BOT_CANISTER_ID \
  $STORAGE_INDEX_CANISTER_ID \
  $CYCLES_DISPENSER_CANISTER_ID \
  $MARKET_MAKER_CANISTER_ID \
  $NNS_GOVERNANCE_CANISTER_ID \
  $NNS_INTERNET_IDENTITY_CANISTER_ID \
  $NNS_LEDGER_CANISTER_ID \
  $NNS_CMC_CANISTER_ID \