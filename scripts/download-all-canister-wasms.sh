#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

COMMIT_ID=$1

if [ -z "$COMMIT_ID" ]
then
  COMMIT_ID=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
fi

echo "Downloading wasms at commit $COMMIT_ID"

./download-canister-wasm.sh group $COMMIT_ID
./download-canister-wasm.sh group_index $COMMIT_ID
./download-canister-wasm.sh local_group_index $COMMIT_ID
./download-canister-wasm.sh local_user_index $COMMIT_ID
./download-canister-wasm.sh notifications $COMMIT_ID
./download-canister-wasm.sh notifications_index $COMMIT_ID
./download-canister-wasm.sh online_users $COMMIT_ID
./download-canister-wasm.sh proposals_bot $COMMIT_ID
./download-canister-wasm.sh user $COMMIT_ID
./download-canister-wasm.sh user_index $COMMIT_ID

echo "Wasms downloaded"