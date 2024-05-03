#!/bin/bash

VERSION=$1
CHANGELOG_PATH=$2

TITLE="Upgrade EventStore canister to $VERSION"
CHANGELOG=`cat $CHANGELOG_PATH`
CANISTER_NAME=event_store
URL="https://github.com/open-chat-labs/event-store/releases/tag/v$VERSION"

# Set current directory to the repo's root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/../..

./scripts/download-canister-wasm-dfx.sh event_store || exit 1

set -o allexport; source .env; set +o allexport

./sns/scripts/utils/setup_env.sh

SUMMARY="## GitHub release

https://github.com/open-chat-labs/event-store/releases/tag/v$VERSION

## Changelog

$CHANGELOG"

# Submit the proposal
./sns/scripts/utils/submit_upgrade_proposal.sh $CANISTER_NAME $VERSION "$TITLE" "$URL" "$SUMMARY"

# Cleanup
./sns/scripts/utils/cleanup_env.sh