#!/bin/sh

# cd into the folder containing this script
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Extract the args
VERSION=$1
SUMMARY_PATH=$2

TITLE="Upgrade website to $VERSION"
URL="https://github.com/open-chat-labs/open-chat/releases/tag/v${VERSION}-website"

# Make the proposal
./motion.sh "$TITLE" "$URL" "$SUMMARY_PATH"
