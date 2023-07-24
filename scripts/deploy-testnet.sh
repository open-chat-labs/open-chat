#!/bin/sh

NETWORK=$1
IC_URL=$2
IDENTITY=${3:-default}
WASM_SRC=${4:-latest} # WASM_SRC is either empty, "build", "latest", "local", "prod" or the commit Id

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

NNS_ROOT_CANISTER_ID=r7inp-6aaaa-aaaaa-aaabq-cai
NNS_GOVERNANCE_CANISTER_ID=rrkah-fqaaa-aaaaa-aaaaq-cai
NNS_INTERNET_IDENTITY_CANISTER_ID=qhbym-qaaaa-aaaaa-aaafq-cai
NNS_LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai
NNS_CMC_CANISTER_ID=rkp4c-7iaaa-aaaaa-aaaca-cai

# Create the OpenChat canisters
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 user_index
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 group_index
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 notifications_index
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 local_user_index
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 local_group_index
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 notifications
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 online_users
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 proposals_bot
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 1000000000000000 storage_index
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 1000000000000000 cycles_dispenser
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 registry
dfx --identity $IDENTITY canister create --provisional-create-canister-effective-canister-id jrlun-jiaaa-aaaab-aaaaa-cai --network $NETWORK --no-wallet --with-cycles 100000000000000 market_maker

# Install the OpenChat canisters
./scripts/deploy.sh $NETWORK \
    $IC_URL \
    $IDENTITY \
    $WASM_SRC \
    $NNS_ROOT_CANISTER_ID \
    $NNS_GOVERNANCE_CANISTER_ID \
    $NNS_INTERNET_IDENTITY_CANISTER_ID \
    $NNS_LEDGER_CANISTER_ID \
    $NNS_CMC_CANISTER_ID \
    $NNS_SNS_WASM_CANISTER_ID \
    true \