#!/bin/bash

set -e

# Arguments: network, IC URL, identity, canister, version, WASM source, trusted SHA-256.
# Use an empty WASM source ("") to build locally. Obtain the digest independently
# from the trusted release/build record, never from the file downloaded here.

NETWORK=$1
IC_URL=$2
IDENTITY=$3
CANISTER_NAME=$4
VERSION=$5
WASM_SRC=$6 # WASM_SRC is either empty, "build", "latest", "local", "prod" the commit Id or the release version
EXPECTED_WASM_SHA256=$7

if [[ ! "$EXPECTED_WASM_SHA256" =~ ^[0-9A-Fa-f]{64}$ ]]; then
    printf '%s\n' 'Expected argument 7: exactly 64 ASCII hexadecimal characters for the trusted Wasm SHA-256.' >&2
    exit 2
fi

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd "$SCRIPT_DIR/.."

if [[ -z "$WASM_SRC" || $WASM_SRC = "build" ]]
then
    ./scripts/generate-wasm.sh "$CANISTER_NAME"
elif [ "$WASM_SRC" != "local" ]
then
    ./scripts/download-canister-wasm.sh "$CANISTER_NAME" "$WASM_SRC"
fi

OPENCHAT_INSTALLER_CANISTER_ID=$(dfx canister --network "$NETWORK" id openchat_installer)
USER_INDEX_CANISTER_ID=$(dfx canister --network "$NETWORK" id user_index)
GROUP_INDEX_CANISTER_ID=$(dfx canister --network "$NETWORK" id group_index)
NOTIFICATIONS_INDEX_CANISTER_ID=$(dfx canister --network "$NETWORK" id notifications_index)
IDENTITY_CANISTER_ID=$(dfx canister --network "$NETWORK" id identity)
ONLINE_USERS_CANISTER_ID=$(dfx canister --network "$NETWORK" id online_users)
PROPOSALS_BOT_CANISTER_ID=$(dfx canister --network "$NETWORK" id proposals_bot)
AIRDROP_BOT_CANISTER_ID=$(dfx canister --network "$NETWORK" id airdrop_bot)
STORAGE_INDEX_CANISTER_ID=$(dfx canister --network "$NETWORK" id storage_index)
CYCLES_DISPENSER_CANISTER_ID=$(dfx canister --network "$NETWORK" id cycles_dispenser)
REGISTRY_CANISTER_ID=$(dfx canister --network "$NETWORK" id registry)
MARKET_MAKER_CANISTER_ID=$(dfx canister --network "$NETWORK" id market_maker)
NEURON_CONTROLLER_CANISTER_ID=$(dfx canister --network "$NETWORK" id neuron_controller)
ESCROW_CANISTER_ID=$(dfx canister --network "$NETWORK" id escrow)
TRANSLATIONS_CANISTER_ID=$(dfx canister --network "$NETWORK" id translations)
EVENT_RELAY_CANISTER_ID=$(dfx canister --network "$NETWORK" id event_relay)
EVENT_STORE_CANISTER_ID=$(dfx canister --network "$NETWORK" id event_store)
SIGN_IN_WITH_EMAIL_CANISTER_ID=$(dfx canister --network "$NETWORK" id sign_in_with_email)

cargo run \
  --manifest-path backend/tools/canister_upgrader/Cargo.toml -- \
  --url "$IC_URL" \
  --controller "$IDENTITY" \
  --openchat-installer "$OPENCHAT_INSTALLER_CANISTER_ID" \
  --user-index "$USER_INDEX_CANISTER_ID" \
  --group-index "$GROUP_INDEX_CANISTER_ID" \
  --notifications-index "$NOTIFICATIONS_INDEX_CANISTER_ID" \
  --identity "$IDENTITY_CANISTER_ID" \
  --online-users "$ONLINE_USERS_CANISTER_ID" \
  --proposals-bot "$PROPOSALS_BOT_CANISTER_ID" \
  --airdrop-bot "$AIRDROP_BOT_CANISTER_ID" \
  --storage-index "$STORAGE_INDEX_CANISTER_ID" \
  --cycles-dispenser "$CYCLES_DISPENSER_CANISTER_ID" \
  --registry "$REGISTRY_CANISTER_ID" \
  --market-maker "$MARKET_MAKER_CANISTER_ID" \
  --neuron-controller "$NEURON_CONTROLLER_CANISTER_ID" \
  --escrow "$ESCROW_CANISTER_ID" \
  --translations "$TRANSLATIONS_CANISTER_ID" \
  --event-relay "$EVENT_RELAY_CANISTER_ID" \
  --event-store "$EVENT_STORE_CANISTER_ID" \
  --sign-in-with-email "$SIGN_IN_WITH_EMAIL_CANISTER_ID" \
  --canister-to-upgrade "$CANISTER_NAME" \
  --version "$VERSION" \
  --expected-wasm-sha256 "$EXPECTED_WASM_SHA256"
