#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./utils/setup_env.sh

for file in ./proposals/create_custom_sns_functions/*
do
    # Extract the FUNCTION_ID, TARGET_CANISTER and TARGET_NAME from the filename
    FILENAME="${file##*/}"
    IFS='.' read -ra ADDR <<< "$FILENAME"
    FUNCTION_ID=${ADDR[0]}
    TARGET_CANISTER=${ADDR[1]}
    TARGET_NAME=${ADDR[2]}

    # Source FUNCTION_NAME, FUNCTION_DESC, URL from the file contents
    source $file

    # Derive the remaining variables
    VALIDATOR_CANISTER=$TARGET_CANISTER
    TITLE="Add a new custom SNS function to \\\"$FUNCTION_NAME\\\""
    SUMMARY=$FUNCTION_DESC

    # Make the proposal
    ./proposals/create_custom_sns_function.sh "$TITLE" "$URL" "$SUMMARY" $FUNCTION_ID "$FUNCTION_NAME" "$FUNCTION_DESC" $TARGET_CANISTER $TARGET_NAME $VALIDATOR_CANISTER
done

./utils/cleanup_env.sh
