#!/bin/sh

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
if [ -z "${DEVELOPER_NEURON_ID}" ]
then
  echo "Missing environment variable DEVELOPER_NEURON_ID"
  exit 1
fi
if [ -z "${PEM_FILE}" ]
then
  echo "Missing environment variable PEM_FILE"
  exit 1
fi

echo $NETWORK

# Create the sns_canister_ids.json
FILE_NAME=''"$NETWORK"'_sns_canister_ids.json'
./build_sns_canister_ids_json.sh > $FILE_NAME