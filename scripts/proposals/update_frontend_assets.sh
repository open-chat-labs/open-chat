#!/bin/bash

# cd into the folder containing this script
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Extract the args
VERSION=$1
SUMMARY_PATH=$2
BATCH_ID=$3
EVIDENCE=$4

SUMMARY=`cat $SUMMARY_PATH`

TITLE="Upgrade website to $VERSION"
URL="https://github.com/open-chat-labs/open-chat/releases/tag/v${VERSION}-website"

# update_token args
ARGS="(record {
    batch_id=$BATCH_ID:nat;
    evidence=blob \"\\f7\\85\\60\\c3\\fb\\6e\\b6\\6f\\89\\d9\\88\\23\\37\\90\\f5\\02\\7b\\1c\\5a\\80\\16\\83\\d4\\f2\\92\\cc\\ef\\5a\\15\\21\\20\\d0\":blob;
})"

FUNCTION_ID=10000

# Submit the proposal
../make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"

