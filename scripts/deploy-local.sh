#!/bin/bash

# Deploys everything needed to test OpenChat locally (OpenChat, OpenStorage and the NNS canisters)

IDENTITY=${1:-default}
WASM_SRC=${2:-latest} # WASM_SRC is either empty, "build", "latest", "local", "prod" the commit Id or the release version

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Create and install the NNS canisters
if ! dfx extension install nns --version 0.5.0 >& /dev/null
then
  echo "Updating the DFX NNS extension to version 0.5.0"
  dfx extension uninstall nns
  dfx extension install nns --version 0.5.0 >& /dev/null
fi

TEST_ICP_ACCOUNT=$(dfx --identity $IDENTITY ledger account-id)
dfx --identity $IDENTITY nns install --ledger-accounts $TEST_ICP_ACCOUNT
# Stop the SNS aggregator so that it doesn't spam the logs
dfx --identity anonymous canister stop sgymv-uiaaa-aaaaa-aaaia-cai &

NNS_ROOT_CANISTER_ID=r7inp-6aaaa-aaaaa-aaabq-cai
NNS_GOVERNANCE_CANISTER_ID=rrkah-fqaaa-aaaaa-aaaaq-cai
NNS_INTERNET_IDENTITY_CANISTER_ID=qhbym-qaaaa-aaaaa-aaafq-cai
NNS_LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai
NNS_CMC_CANISTER_ID=rkp4c-7iaaa-aaaaa-aaaca-cai
NNS_SNS_WASM_CANISTER_ID=qaa6y-5yaaa-aaaaa-aaafa-cai
NNS_INDEX_CANISTER_ID=qhbym-qaaaa-aaaaa-aaafq-cai

echo "Building local_canister_creator"
cargo build --package local_canister_creator
echo "Building completed"

echo "Creating canisters"
cargo run --package local_canister_creator -- \
  --ic-url http://127.0.0.1:8080/ \
  --pocket-ic-url http://127.0.0.1:$(dfx info pocketic-config-port) \
  --controller $IDENTITY \
  --cycles 1000000000000000 \
  --canister-ids-json-dir .dfx/local \
  --canister openchat_installer \
  --canister user_index \
  --canister group_index \
  --canister notifications_index \
  --canister local_user_index \
  --canister local_group_index \
  --canister notifications \
  --canister identity \
  --canister online_users \
  --canister proposals_bot \
  --canister airdrop_bot \
  --canister storage_index \
  --canister cycles_dispenser \
  --canister registry \
  --canister market_maker \
  --canister neuron_controller \
  --canister escrow \
  --canister translations \
  --canister event_relay \
  --canister event_store \
  --canister sign_in_with_email \
  --canister sign_in_with_ethereum \
  --canister sign_in_with_solana \
  --canister website || exit 1

echo "Canisters created"

# Install the OpenChat canisters
./scripts/deploy.sh local \
    http://127.0.0.1:8080/ \
    $IDENTITY \
    $WASM_SRC \
    $NNS_ROOT_CANISTER_ID \
    $NNS_GOVERNANCE_CANISTER_ID \
    $NNS_INTERNET_IDENTITY_CANISTER_ID \
    $NNS_LEDGER_CANISTER_ID \
    $NNS_CMC_CANISTER_ID \
    $NNS_SNS_WASM_CANISTER_ID \
    $NNS_INDEX_CANISTER_ID \
    true \

./scripts/get-test-icp.sh "w7lou-c7777-77774-qaamq-cai" $IDENTITY
./scripts/deploy-test-ledger.sh $IDENTITY
./scripts/mint-test-tokens.sh "w7lou-c7777-77774-qaamq-cai" $IDENTITY
./scripts/get-public-key.sh $IDENTITY > ./frontend/app/public/public-key