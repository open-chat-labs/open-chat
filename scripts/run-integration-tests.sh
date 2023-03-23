#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

BUILD_WASMS=${1:-true}
TEST_THREADS=${2:-2}
TESTNAME=$3

if [ $BUILD_WASMS = true ]
then
    ./scripts/generate-all-canister-wasms.sh
fi

pushd backend/integration_tests/local-bin
curl -sO https://download.dfinity.systems/ic/d56e4ad49b21e23a3d6c2923493e78ef498a0c1c/binaries/x86_64-darwin/ic-test-state-machine.gz
gzip -df ic-test-state-machine.gz
chmod +x ic-test-state-machine
popd

./scripts/download-nns-canister-wasm.sh icp_ledger ledger-canister_notify-method
./scripts/download-nns-canister-wasm.sh cycles_minting_canister cycles-minting-canister

cargo test --release --package integration_tests $TESTNAME -- --test-threads $TEST_THREADS
