#!/bin/sh

# Pass in network name, IC url, identity name, canister name, and version
# eg './upgrade-canister.sh local http://127.0.0.1:8080/ openchat user_index 1.0.0'

NETWORK=$1
IC_URL=$2
IDENTITY=$3
CANISTER_NAME=$4
VERSION=$5
WASM_SRC=$6 # WASM_SRC is either empty, "build", "latest", "local", prod" or the commit Id

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if [[ -z "$WASM_SRC" || $WASM_SRC = "build" ]]
then
    ./scripts/generate-wasm.sh $CANISTER_NAME
elif [ $WASM_SRC != "local" ]
then
    ./scripts/download-canister-wasm.sh $CANISTER_NAME $WASM_SRC || exit 1
fi

USER_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id notifications_index)
ONLINE_USERS_CANISTER_ID=$(dfx canister --network $NETWORK id online_users)
PROPOSALS_BOT_CANISTER_ID=$(dfx canister --network $NETWORK id proposals_bot)
STORAGE_INDEX_CANISTER_ID=$(dfx canister --network $NETWORK id storage_index)
CYCLES_DISPENSER_CANISTER_ID=$(dfx canister --network $NETWORK id cycles_dispenser)
REGISTRY_CANISTER_ID=$(dfx canister --network $NETWORK id registry)
MARKET_MAKER_CANISTER_ID=$(dfx canister --network $NETWORK id market_maker)

cargo run \
  --manifest-path backend/canister_upgrader/Cargo.toml -- \
  --url $IC_URL \
  --controller $IDENTITY \
  --user-index $USER_INDEX_CANISTER_ID \
  --group-index $GROUP_INDEX_CANISTER_ID \
  --notifications-index $NOTIFICATIONS_INDEX_CANISTER_ID \
  --online-users $ONLINE_USERS_CANISTER_ID \
  --proposals-bot $PROPOSALS_BOT_CANISTER_ID \
  --storage-index $STORAGE_INDEX_CANISTER_ID \
  --cycles-dispenser $CYCLES_DISPENSER_CANISTER_ID \
  --registry $REGISTRY \
  --market-maker $MARKET_MAKER_CANISTER_ID \
  --canister-to-upgrade $CANISTER_NAME \
  --version $VERSION \