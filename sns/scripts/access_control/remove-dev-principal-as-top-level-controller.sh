#!/bin/sh

echo "Remove the dev principal from the list of controllers for each top-level OC canister"

OC_DFX_PRINCIPAL=$(dfx --identity $IDENTITY identity get-principal)

dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL user_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL group_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL notifications_index
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL online_users
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL proposals_bot
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL cycles_dispenser
dfx -qq --identity $IDENTITY canister --network $NETWORK update-settings --remove-controller $OC_DFX_PRINCIPAL open_storage_index
