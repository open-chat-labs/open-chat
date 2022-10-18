#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

BUILD_WASMS=${1:-true}

if [ $BUILD_WASMS = true ]
then
    ./scripts/generate-all-canister-wasms.sh
fi

cargo test --release --package integration_tests -- --test-threads 4
