#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

WASM_SRC=${1:-build}
TEST_THREADS=${2:-2}
TESTNAME=$3
POCKET_IC_SERVER_VERSION="3.0.0"

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
    ./scripts/generate-all-canister-wasms.sh
elif [[ $WASM_SRC != "local" ]]
then
    ./scripts/download-all-canister-wasms.sh $WASM_SRC || exit 1
fi

cd backend/integration_tests
echo "PocketIC download starting"
curl -Ls https://github.com/dfinity/pocketic/releases/download/${POCKET_IC_SERVER_VERSION}/pocket-ic-x86_64-${PLATFORM}.gz -o pocket-ic.gz || exit 1
gzip -df pocket-ic.gz
chmod +x pocket-ic
echo "PocketIC download completed"
cd ../..

./scripts/download-nns-canister-wasm.sh icp_ledger ledger-canister_notify-method
./scripts/download-nns-canister-wasm.sh cycles_minting_canister cycles-minting-canister
./scripts/download-nns-canister-wasm.sh sns_wasm sns-wasm-canister
./scripts/download-nns-canister-wasm.sh icrc_ledger ic-icrc1-ledger

cargo test --package integration_tests $TESTNAME -- --test-threads $TEST_THREADS
