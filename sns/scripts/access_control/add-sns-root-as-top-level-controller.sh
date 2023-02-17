#!/bin/sh

echo "Add the sns_root canister to the list of controllers for each top-level OC canister"

SNS_ROOT_CANISTER_ID=$(dfx canister --network $NETWORK id sns_root)

dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID user_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID group_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID notifications_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID online_users
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID proposals_bot
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID cycles_dispenser
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID open_storage_index
