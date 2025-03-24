#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

WASM_SRC=${1:-build}
TEST_THREADS=${2:-6}
TESTNAME=$3
POCKET_IC_SERVER_VERSION="8.0.0"

if [[ $OSTYPE == "linux-gnu"* ]] || [[ $RUNNER_OS == "Linux" ]]
then
    PLATFORM=linux
elif [[ $OSTYPE == "darwin"* ]] || [[ $RUNNER_OS == "macOS" ]]
then
    PLATFORM=darwin
else
    echo "OS not supported: ${OSTYPE:-$RUNNER_OS}"
    exit 1
fi

if [[ $WASM_SRC == "build" ]]
then
    ./scripts/generate-all-canister-wasms.sh || exit 1
elif [[ $WASM_SRC != "local" ]]
then
    ./scripts/download-all-canister-wasms.sh $WASM_SRC || exit 1
fi

cd backend/integration_tests
echo "PocketIC download starting"
curl -Ls https://download.dfinity.systems/ic/4833f30d3b5afd84a385dfb146581580285d8a7e/binaries/x86_64-${PLATFORM}/pocket-ic.gz -o pocket-ic.gz || exit 1
gzip -df pocket-ic.gz
chmod +x pocket-ic
echo "PocketIC download completed"
cd ../..

./scripts/download-nns-canister-wasm.sh icp_ledger ledger-canister_notify-method
./scripts/download-nns-canister-wasm.sh cycles_minting_canister cycles-minting-canister
./scripts/download-nns-canister-wasm.sh sns_wasm sns-wasm-canister
./scripts/download-nns-canister-wasm.sh icrc_ledger ic-icrc1-ledger
./scripts/download-canister-wasm-dfx.sh event_store || exit 1
./scripts/download-canister-wasm-dfx.sh sign_in_with_email || exit 1

function cleanup() {
  rm -rf ./backend/integration_tests/pocket_ic_state
}

trap cleanup EXIT

cargo test --package integration_tests $TESTNAME -- --test-threads $TEST_THREADS || exit 1

cleanup
