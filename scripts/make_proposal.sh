#!/bin/sh

# cd into root of OpenChat repo
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport

# We'll re-organise these folders after SNS launch
./sns/scripts/utils/setup_env.sh

# Extract the args
PROPOSAL=$1

# Submit the proposal
./sns/scripts/utils/submit_proposal.sh "$PROPOSAL"

# Cleanup
./sns/scripts/utils/cleanup_env.sh
