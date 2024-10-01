#!/bin/bash

VERSION=$1
CHANGELOG_PATH=$2

TITLE="Upgrade EventStore canister to $VERSION"
URL="https://github.com/open-chat-labs/event-store/releases/tag/v$VERSION"
CANISTER_NAME=event_store
CHANGELOG=`cat $CHANGELOG_PATH`

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

SUMMARY="## GitHub release

$URL

## Changelog

$CHANGELOG"

# Submit the proposal
./make_upgrade_external_canister_proposal.sh $CANISTER_NAME "$VERSION" "$TITLE" "$URL" "$SUMMARY"
