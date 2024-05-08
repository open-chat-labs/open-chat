#!/bin/bash

VERSION=$1
CHANGELOG_PATH=$2

TITLE="Upgrade SignInWithEmail canister to $VERSION"
CHANGELOG=`cat $CHANGELOG_PATH`
CANISTER_NAME=sign_in_with_email
URL="https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v$VERSION"

# Set current directory to the repo's root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/../..

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./sns/scripts/utils/setup_env.sh

./scripts/download-canister-wasm-dfx.sh sign_in_with_email || exit 1

SUMMARY="## GitHub release

https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v$VERSION

## Changelog

$CHANGELOG"

# Build the canister-upgrade-arg
UPGRADE_ARG="(variant { Upgrade = record { } })"

# Submit the proposal
./sns/scripts/utils/submit_upgrade_proposal.sh $CANISTER_NAME $VERSION "$TITLE" "$URL" "$SUMMARY" "$UPGRADE_ARG"

# Cleanup
./sns/scripts/utils/cleanup_env.sh