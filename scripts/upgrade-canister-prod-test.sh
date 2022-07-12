#!/bin/sh

# Pass in the dfx identity name
# eg './upgrade-canister-prod-test.sh openchat user_index 1.0.0'

IDENTITY=$1
CANISTER_NAME=$2
VERSION=$3

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

./upgrade-canister.sh ic_test https://ic0.app/ $IDENTITY $CANISTER_NAME $VERSION
