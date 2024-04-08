#!/bin/bash

# Extract the args or use defaults
USER_ID=$1
USER_NAME=$2
SUMMARY=${3:-"Platform moderators can perform some privileged actions to help moderate OpenChat in response to breaches of the [platform rules](https://oc.app/guidelines?section=3).\n\nThey can delete messages and suspend users. In the case of rogue owners they can also assume ownership of groups/communities they are members of."}

# Build the title
TITLE="Add user $USER_NAME ($USER_ID) to the list of platform moderators"

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# add_platform_operator args
ARGS="(record { user_id=principal \"$USER_ID\" })"
FUNCTION_ID=1008

# Submit the proposal
./make_custom_function_proposal.sh $FUNCTION_ID "$TITLE" "$SUMMARY" "" "$ARGS"
