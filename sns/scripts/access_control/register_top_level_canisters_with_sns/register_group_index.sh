#!/bin/sh

CANISTER="group_index"
TITLE="Register group_index as an SNS controlled canister"
URL="https://github.com/open-ic/open-chat/tree/master/backend/canisters/group_index"
SUMMARY="This canister holds a registry of the OC groups and controls the local_group_index canister in each subnet"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"