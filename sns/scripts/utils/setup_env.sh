#!/bin/sh

# Check the necessary environment variables have been set
if [ -z "${NETWORK}" ]
then
  echo "Missing environment variable NETWORK"
  exit 1
fi
if [ -z "${IDENTITY}" ]
then
  echo "Missing environment variable IDENTITY"
  exit 1
fi
if [ -z "${IC_URL}" ]
then
  echo "Missing environment variable IC_URL"
  exit 1
fi
if [ -z "${PROPOSER_NEURON_ID}" ]
then
  echo "Missing environment variable PROPOSER_NEURON_ID"
  exit 1
fi
if [ -z "${PEM_FILE}" ]
then
  echo "Missing environment variable PEM_FILE"
  exit 1
fi
if [ -z "${WASM_FOLDER}" ]
then
  echo "Missing environment variable WASM_FOLDER"
  exit 1
fi
if [ -z "${YES_TO_PROPOSALS}" ]
then
  echo "Missing environment variable YES_TO_PROPOSALS"
  exit 1
fi

# Write the network
echo NETWORK=$NETWORK

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Create the sns_canister_ids.json
./build_sns_canister_ids_json.sh > sns_canister_ids.json