#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport
source .env
set +o allexport

./setup_env.sh

./access_control/add-sns-root-as-top-level-controller.sh
./access_control/add-sns-governance-to-canisters-acl.sh
./access_control/register_all_top_level_canisters_with_sns.sh

./cleanup_env.sh
