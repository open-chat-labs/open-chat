#!/bin/bash

# Submits the SNS proposal which activates a chunk-uploaded personhood
# verification model, pinned to its sha256 hash.
#
# Usage: ./commit_personhood_model.sh KIND VERSION SHA256 [SUMMARY]
#   KIND    - Detection | Landmarks | Embedding
#   VERSION - model version (nat16); must be > the current version for
#             Embedding commits (visible at the canister's /metrics)
#   SHA256  - hex-encoded sha256 of the complete model file; printed by
#             `verification_model_uploader --skip-commit`
#
# The commit only succeeds if the uploaded chunks hash to exactly SHA256,
# so a bad or tampered upload cannot be activated.

KIND=$1
VERSION=$2
SHA256=$3
SUMMARY=${4:-"Activates the $KIND model (version $VERSION) previously chunk-uploaded to the personhood_verifier canister. The commit is pinned to sha256 $SHA256 and only takes effect if the uploaded bytes hash to exactly that value."}

TITLE="Commit personhood verification $KIND model v$VERSION"
URL="https://github.com/open-chat-labs/open-chat/issues/9072"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# commit_model args
ARGS="(record { kind=variant { $KIND }; version=$VERSION:nat16; sha256=\"$SHA256\" })"
FUNCTION_ID=11000

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
