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

    # Source FUNCTION_NAME, FUNCTION_DESC, URL from the file contents
    source $file

    SUMMARY=$FUNCTION_DESC

    if [ ${#FUNCTION_ID} -lt 6 ] # This means the FunctionId is less than 100000
    then
        TARGET_CANISTER=${ADDR[1]}
        TARGET_NAME=${ADDR[2]}

        # Derive the remaining variables
        TITLE="Add a new custom SNS function to \\\"$FUNCTION_NAME\\\""
        TARGET_CANISTER_ID=$(dfx -qq canister --network $NETWORK id $TARGET_CANISTER)
        VALIDATOR_CANISTER=$TARGET_CANISTER
        VALIDATOR_CANISTER_ID=$(dfx -qq canister --network $NETWORK id $VALIDATOR_CANISTER)
        VALIDATOR_NAME="${TARGET_NAME}_validate"
    else
        SERVICE_NAME=${ADDR[1]}
        TARGET_NAME=${ADDR[2]}
        TARGET_CANISTER_ID=${ADDR[3]}

        # Derive the remaining variables
        VALIDATOR_CANISTER_ID=$(dfx -qq canister --network $NETWORK id proposal_validation)
        VALIDATOR_NAME="${SERVICE_NAME}_${TARGET_NAME}_validate"
    fi

    # Make the proposal
    ./proposals/create_custom_sns_function.sh "$TITLE" "$URL" "$SUMMARY" $FUNCTION_ID "$FUNCTION_NAME" "$FUNCTION_DESC" "$TARGET_CANISTER_ID" "$TARGET_NAME" "$VALIDATOR_CANISTER_ID" "$VALIDATOR_NAME"
done

./utils/cleanup_env.sh
