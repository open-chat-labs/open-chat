#!/bin/bash

# Extract the args or use defaults
CANISTER_ID=$1
SUMMARY=${2:-"The DailyPuzzle canister generates each day's puzzle and distributes it to the LocalUserIndex canisters. This proposal records its canister id on the UserIndex, which pushes it to every LocalUserIndex, including any added later. Until this is set, the daily puzzle is not available to users."}

# Build the title
TITLE="Set the DailyPuzzle canister id to $CANISTER_ID"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# set_daily_puzzle_canister_id args
ARGS="(record { canister_id=principal \"$CANISTER_ID\" })"
FUNCTION_ID=1018

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
