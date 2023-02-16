#!/bin/sh

CANISTER="cycles_dispenser"
TITLE="Register cycles_dispenser as an SNS controlled canister"
URL="https://github.com/open-ic/cycles-dispenser/tree/main/canister"
SUMMARY="This canister is responsible for topping up the other canisters with cycles"

./register_canister.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"