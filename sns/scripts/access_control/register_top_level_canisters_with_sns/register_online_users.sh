#!/bin/sh

CANISTER="online_users"
TITLE="Register online_users as an SNS controlled canister"
URL="https://github.com/open-ic/open-chat/tree/master/backend/canisters/online_users"
SUMMARY="This canister maintains the last online timestamps for each user"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"