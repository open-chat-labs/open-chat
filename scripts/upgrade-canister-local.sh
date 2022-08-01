#!/bin/sh

# Pass in the dfx identity name
# eg './upgrade-canister-local.sh openchat user_index 1.0.0'

IDENTITY=$1
CANISTER_NAME=$2
VERSION=$3

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

./upgrade-canister.sh local http://127.0.0.1:8000/ $IDENTITY $CANISTER_NAME $VERSION