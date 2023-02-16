#!/bin/sh

echo "Call set_governance_principals with the sns_governance canister + OC dev principal for top-level OC canisters"

SNS_GOVERNANCE_CANISTER_ID=$(dfx canister --network $NETWORK id sns_governance)
OC_DFX_PRINCIPAL=$(dfx --identity $IDENTITY identity get-principal)

CANDID="(record { principals = vec {principal \"$SNS_GOVERNANCE_CANISTER_ID\"; principal \"$OC_DFX_PRINCIPAL\"}})"

dfx -qq --identity $IDENTITY canister --network $NETWORK call user_index set_governance_principals $CANDID
dfx -qq --identity $IDENTITY canister --network $NETWORK call group_index set_governance_principals $CANDID
dfx -qq --identity $IDENTITY canister --network $NETWORK call notifications_index set_governance_principals $CANDID
dfx -qq --identity $IDENTITY canister --network $NETWORK call proposals_bot set_governance_principals $CANDID
dfx -qq --identity $IDENTITY canister --network $NETWORK call open_storage_index set_governance_principals $CANDID
dfx -qq --identity $IDENTITY canister --network $NETWORK call cycles_dispenser set_governance_principals $CANDID
