#!/bin/sh

CANISTER="open_storage_index"
TITLE="Register the open_storage_index as an SNS controlled canister"
URL="https://github.com/open-ic/open-storage/tree/main/backend/canisters/index"
SUMMARY="This canister holds an index of stored files and controls the open_storage_bucket canisters in each subnet"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"