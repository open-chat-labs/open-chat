#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

BUILD_WASMS=${1:-true}
TEST_THREADS=${2:-2}

if [ $BUILD_WASMS = true ]
then
    ./scripts/generate-all-canister-wasms.sh
fi

if ! command -v protoc &> /dev/null
then
    echo "Installing protoc"
    apt update
    apt install -y protobuf-compiler
fi

cargo test --release --package integration_tests -- --test-threads $TEST_THREADS
