#!/bin/sh

TITLE=$1
URL=$2
SUMMARY_PATH=$3
VERSION=$4

SUMMARY=`cat $SUMMARY_PATH`

FUNCTION_ID=1001
CANISTER=user

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Submit the proposal
./make_custom_upgrade_canister_proposal.sh "$TITLE" "$URL" "$SUMMARY" "$VERSION" $FUNCTION_ID $CANISTER
