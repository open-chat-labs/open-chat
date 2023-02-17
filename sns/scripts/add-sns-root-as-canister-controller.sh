#!/bin/sh

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./utils/setup_env.sh

SNS_ROOT_CANISTER_ID=$(dfx canister --network $NETWORK id sns_root)

dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID user_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID group_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID notifications_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID online_users
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID proposals_bot
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID cycles_dispenser
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID open_storage_index

./utils/cleanup_env.sh
