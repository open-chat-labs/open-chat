#!/bin/bash

# Pass in the dfx identity name
# eg './merge-latest-translations.sh openchat'

IDENTITY=${1:-default}

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TRANSLATIONS_CANISTER_ID=$(dfx canister --network ic id translations)

cargo run \
  --manifest-path backend/translation_tool/Cargo.toml -- \
  --action merge \
  --translations-canister-id $TRANSLATIONS_CANISTER_ID \
  --url https://ic0.app/ \
  --controller $IDENTITY \
  --directory frontend/app/src/i18n \
