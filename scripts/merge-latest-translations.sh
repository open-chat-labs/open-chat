#!/bin/bash

# Pass in network name, IC url, identity name
# eg './merge-latest-translations.sh local http://127.0.0.1:8080/ openchat'

NETWORK=$1
IC_URL=$2
IDENTITY=$3

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TRANSLATIONS_CANISTER_ID=$(dfx canister --network $NETWORK id translations)

cargo run \
  --manifest-path backend/translation_merger/Cargo.toml -- \
  --translations-canister-id $TRANSLATIONS_CANISTER_ID \
  --url $IC_URL \
  --controller $IDENTITY \
  --directory frontend/app/src/i18n \
