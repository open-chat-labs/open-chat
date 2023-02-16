#!/bin/sh

CANISTER="notifications_index"
TITLE="Register notifications_index as an SNS controlled canister"
URL="https://github.com/open-ic/open-chat/tree/master/backend/canisters/notifications_index"
SUMMARY="This canister holds a registry of web push notification device subscriptions and controls the notifications canister in each subnet"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"