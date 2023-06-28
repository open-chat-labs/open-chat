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
REGISTRY_CANISTER_ID=$(dfx canister --network $NETWORK id registry)
MARKET_MAKER_CANISTER_ID=$(dfx canister --network $NETWORK id market_maker)

cargo run \
  --manifest-path backend/canister_installer/Cargo.toml -- \
  --url $IC_URL \
  --test-mode $TEST_MODE \
  --controller $IDENTITY \
  --user-index $USER_INDEX_CANISTER_ID \
  --group-index $GROUP_INDEX_CANISTER_ID \
  --notifications-index $NOTIFICATIONS_INDEX_CANISTER_ID \
  --local-user-index $LOCAL_USER_INDEX_CANISTER_ID \
  --local-group-index $LOCAL_GROUP_INDEX_CANISTER_ID \
  --notifications $NOTIFICATIONS_CANISTER_ID \
  --online-users $ONLINE_USERS_CANISTER_ID \
  --proposals-bot $PROPOSALS_BOT_CANISTER_ID \
  --storage-index $STORAGE_INDEX_CANISTER_ID \
  --cycles-dispenser $CYCLES_DISPENSER_CANISTER_ID \
  --registry $REGISTRY_CANISTER_ID \
  --market-maker $MARKET_MAKER_CANISTER_ID \
  --nns-governance $NNS_GOVERNANCE_CANISTER_ID \
  --nns-internet-identity $NNS_INTERNET_IDENTITY_CANISTER_ID \
  --nns-ledger $NNS_LEDGER_CANISTER_ID \
  --nns-cmc $NNS_CMC_CANISTER_ID \