#!/bin/sh

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./utils/setup_env.sh

SNS_GOVERNANCE_CANISTER_ID=$(dfx canister --network $NETWORK id sns_governance)
OC_DFX_PRINCIPAL=$(dfx --identity $IDENTITY identity get-principal)

CANDID="(record { principals = vec {principal \"$SNS_GOVERNANCE_CANISTER_ID\"; principal \"$OC_DFX_PRINCIPAL\"}})"

dfx -qq --identity $IDENTITY canister --network $NETWORK call user_index set_governance_principals "$CANDID"
dfx -qq --identity $IDENTITY canister --network $NETWORK call group_index set_governance_principals "$CANDID"
dfx -qq --identity $IDENTITY canister --network $NETWORK call notifications_index set_governance_principals "$CANDID"
dfx -qq --identity $IDENTITY canister --network $NETWORK call proposals_bot set_governance_principals "$CANDID"
dfx -qq --identity $IDENTITY canister --network $NETWORK call storage_index set_governance_principals "$CANDID"
dfx -qq --identity $IDENTITY canister --network $NETWORK call cycles_dispenser set_governance_principals "$CANDID"

./utils/cleanup_env.sh
