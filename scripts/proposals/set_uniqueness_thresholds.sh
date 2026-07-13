#!/bin/bash

# Submits the SNS proposal which tunes the personhood_verifier's uniqueness
# bands. The right values track the enrolled population size (visible at the
# canister's /metrics), which grows over time.
#
# Usage: ./set_uniqueness_thresholds.sh DUPLICATE CLEAR DUPLICATE_RETRY [SUMMARY]
#   e.g.  ./set_uniqueness_thresholds.sh 0.55 0.45 0.50
#
# Must satisfy CLEAR <= DUPLICATE_RETRY <= DUPLICATE (all in [0, 1]);
# the canister rejects anything else.

DUPLICATE=$1
CLEAR=$2
DUPLICATE_RETRY=$3
SUMMARY=${4:-"Sets the personhood_verifier uniqueness bands to duplicate=$DUPLICATE, clear=$CLEAR, duplicate_retry=$DUPLICATE_RETRY. Cosine similarity above 'duplicate' rejects the enrolment as a duplicate of an existing user, below 'clear' accepts it, and the band between 'duplicate_retry' and 'duplicate' asks the user to retry."}

TITLE="Set personhood uniqueness thresholds ($DUPLICATE / $CLEAR / $DUPLICATE_RETRY)"
URL="https://github.com/open-chat-labs/open-chat/issues/9072"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# set_uniqueness_thresholds args
ARGS="(record { duplicate=$DUPLICATE:float32; clear=$CLEAR:float32; duplicate_retry=$DUPLICATE_RETRY:float32 })"
FUNCTION_ID=11001

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "$URL" "$ARGS"
