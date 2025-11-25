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

EVIDENCE_FORMATTED="\\$(echo $EVIDENCE | fold -w2 | paste -sd '\\' -)"

# update_token args
ARGS="(record {
    batch_id=$BATCH_ID:nat;
    evidence=blob \"$EVIDENCE_FORMATTED\":blob;
})"

FUNCTION_ID=10000

# Submit the proposal
../make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"

