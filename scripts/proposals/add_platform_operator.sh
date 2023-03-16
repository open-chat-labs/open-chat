#!/bin/sh

# Extract the args or use defaults
USER_ID=$1
USER_NAME=$2
SUMMARY=${3:-"Platform operators can perform a short list of privileged functions to help operate the OpenChat system.\n\nRight now the only function available is to adjust the concurrency level of rolling user and group upgrades up to a maximum (which itself can only be changed by proposal). However, in the future it is expected the list of operator only functions will grow."}

# Build the title
TITLE="Add user $USER_NAME ($USER_ID) to the list of platform operators"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

#pub user_id: UserId,

# add_platform_operator args
ARGS="(record { user_id=principal \"$USER_ID\" })"
FUNCTION_ID=1010

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
