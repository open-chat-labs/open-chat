#!/bin/sh

CANISTER="proposals_bot"
TITLE="Register the proposals_bot as an SNS controlled canister"
URL="https://github.com/open-ic/open-chat/tree/master/backend/canisters/proposals_bot"
SUMMARY="This canister syncs proposals from the NNS and each registered SNS with the equivalent proposals group in OpenChat"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"