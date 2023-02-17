#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport
./utils/setup_env.sh

for file in ./proposals/register_canisters_with_sns/*
do
    # Extract the CANISTER from the filename
    FILENAME="${file##*/}"
    IFS='.' read -ra ADDR <<< "$FILENAME"
    CANISTER=${ADDR[0]}

    # Source TITLE, SUMMARY and URL from the file contents
    source $file

    # Make the proposal
    ./proposals/register_canister_with_sns.sh $CANISTER "$TITLE" "$URL" "$SUMMARY"
done

./utils/cleanup_env.sh
