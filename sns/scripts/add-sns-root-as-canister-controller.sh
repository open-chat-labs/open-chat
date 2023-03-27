#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

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
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID storage_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID proposal_validation
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --add-controller $SNS_ROOT_CANISTER_ID market_maker

./utils/cleanup_env.sh
