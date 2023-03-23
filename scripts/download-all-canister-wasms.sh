#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

WASM_SRC=$1 # WASM_SRC is either empty, "latest", "prod" or the commit Id

if [ -z "$WASM_SRC" ] || [ $WASM_SRC = "latest" ]
then
  WASM_SRC=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
fi

echo "Downloading wasms"

./download-canister-wasm.sh cycles_dispenser $WASM_SRC
./download-canister-wasm.sh group $WASM_SRC
./download-canister-wasm.sh group_index $WASM_SRC
./download-canister-wasm.sh local_group_index $WASM_SRC
./download-canister-wasm.sh local_user_index $WASM_SRC
./download-canister-wasm.sh notifications $WASM_SRC
./download-canister-wasm.sh notifications_index $WASM_SRC
./download-canister-wasm.sh online_users $WASM_SRC
./download-canister-wasm.sh proposal_validation $WASM_SRC
./download-canister-wasm.sh proposals_bot $WASM_SRC
./download-canister-wasm.sh storage_bucket $WASM_SRC
./download-canister-wasm.sh storage_index $WASM_SRC
./download-canister-wasm.sh user $WASM_SRC
./download-canister-wasm.sh user_index $WASM_SRC

echo "Wasms downloaded"