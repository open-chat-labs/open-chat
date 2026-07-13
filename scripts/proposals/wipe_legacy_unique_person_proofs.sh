#!/bin/bash

# Submits the SNS proposal which triggers the one-off removal of all legacy
# DecideAI unique person proofs (the cutover wipe). Run this only after the
# new verification UI has shipped, so wiped users have a working path to
# re-verify.
#
# Usage: ./wipe_legacy_unique_person_proofs.sh [SUMMARY]

SUMMARY=${1:-"Removes all legacy DecideAI unique person proofs as part of the cutover to the in-house, SNS-controlled personhood verification system. Affected users are notified and can immediately re-verify via the new in-app flow."}

TITLE="Wipe legacy DecideAI unique person proofs"
URL="https://github.com/open-chat-labs/open-chat/issues/9072"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# wipe_legacy_unique_person_proofs args
ARGS="(record {})"
FUNCTION_ID=1017

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
