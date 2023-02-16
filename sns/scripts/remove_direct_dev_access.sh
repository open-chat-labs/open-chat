#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport
source .env
set +o allexport

./access_control/remove-dev-principal-as-top-level-controller.sh
./access_control/remove-dev-principal-from-canisters-acl.sh
