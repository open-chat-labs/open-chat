#!/bin/sh

CANISTER="user_index"
TITLE="Register the user_index as an SNS controlled canister"
URL="https://github.com/open-ic/open-chat/tree/master/backend/canisters/user_index"
SUMMARY="This canister holds a registry of the OC users and controls the local_user_index canister in each subnet"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"
