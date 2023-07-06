#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

BUILD_WASMS=${1:-true}
TEST_THREADS=${2:-2}
TESTNAME=$3

if [[ "$OSTYPE" == "linux-gnu"* || "$RUNNER_OS" == "Linux" ]]
then
    PLATFORM=linux
elif [[ "$OSTYPE" == "darwin"* || "$RUNNER_OS" == "macOS" ]]
then
    PLATFORM=darwin
else
    echo "OS not supported: ${OSTYPE:-$RUNNER_OS}"
    exit 1
fi

if [ $BUILD_WASMS = true ]
then
    ./scripts/generate-all-canister-wasms.sh
fi

cd backend/integration_tests/local-bin
echo "Test state machine download starting"
curl -sO https://download.dfinity.systems/ic/6d21535b301fee2ad3e8a0e8af2c3f9a3d022111/binaries/x86_64-$PLATFORM/ic-test-state-machine.gz
gzip -df ic-test-state-machine.gz
chmod +x ic-test-state-machine
echo "Test state machine download completed"
cd ../../..

./scripts/download-nns-canister-wasm.sh icp_ledger ledger-canister_notify-method
./scripts/download-nns-canister-wasm.sh cycles_minting_canister cycles-minting-canister
./scripts/download-nns-canister-wasm.sh sns_wasm sns-wasm-canister

cargo test --release --package integration_tests $TESTNAME -- --test-threads $TEST_THREADS
