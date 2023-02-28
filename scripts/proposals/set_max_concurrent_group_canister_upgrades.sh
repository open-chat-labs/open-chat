#!/bin/sh

# Extract the args or use defaults
CONCURRENCY=$1
TITLE=${2:-"Set max concurrent group canister upgrades to $CONCURRENCY"}
SUMMARY=${3:-"During a rolling group canister upgrade this controls how many group canisters can be upgraded concurrently."}

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# set_max_concurrent_group_canister_upgrades args
ARGS="(record { value=$CONCURRENCY:nat32 })"
FUNCTION_ID=2004

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
