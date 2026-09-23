#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

WASM_SRC=$1 # WASM_SRC is either empty, "latest", "local", "prod" the commit Id or the release version

if [[ -z $WASM_SRC ]] || [[ $WASM_SRC = "latest" ]]
then
  WASM_SRC=$(curl -s https://openchat-canister-wasms.s3.amazonaws.com/latest)
fi

# Fetch the tags once up front rather than in each of the parallel downloads below, which
# otherwise each fetch them (via get-canister-version.sh) when given a release version
if [[ $WASM_SRC =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]
then
  git fetch -tfq origin master || { echo "Failed to fetch tags"; exit 1; }
  export OC_TAGS_FETCHED=1
fi

echo "Downloading wasms"

pids=()

./download-canister-wasm.sh airdrop_bot $WASM_SRC & pids+=($!)
./download-canister-wasm.sh community $WASM_SRC & pids+=($!)
./download-canister-wasm.sh cycles_dispenser $WASM_SRC & pids+=($!)
./download-canister-wasm.sh daily_puzzle $WASM_SRC & pids+=($!)
./download-canister-wasm.sh escrow $WASM_SRC & pids+=($!)
./download-canister-wasm.sh event_relay $WASM_SRC & pids+=($!)
./download-canister-wasm.sh group $WASM_SRC & pids+=($!)
./download-canister-wasm.sh group_index $WASM_SRC & pids+=($!)
./download-canister-wasm.sh identity $WASM_SRC & pids+=($!)
./download-canister-wasm.sh local_user_index $WASM_SRC & pids+=($!)
./download-canister-wasm.sh multi_user $WASM_SRC & pids+=($!)
./download-canister-wasm.sh neuron_controller $WASM_SRC & pids+=($!)
./download-canister-wasm.sh notifications_index $WASM_SRC & pids+=($!)
./download-canister-wasm.sh online_users $WASM_SRC & pids+=($!)
./download-canister-wasm.sh openchat_installer $WASM_SRC & pids+=($!)
./download-canister-wasm.sh proposal_validation $WASM_SRC & pids+=($!)
./download-canister-wasm.sh proposals_bot $WASM_SRC & pids+=($!)
./download-canister-wasm.sh registry $WASM_SRC & pids+=($!)
./download-canister-wasm.sh sign_in_with_email $WASM_SRC & pids+=($!)
./download-canister-wasm.sh storage_bucket $WASM_SRC & pids+=($!)
./download-canister-wasm.sh storage_index $WASM_SRC & pids+=($!)
./download-canister-wasm.sh translations $WASM_SRC & pids+=($!)
./download-canister-wasm.sh user $WASM_SRC & pids+=($!)
./download-canister-wasm.sh user_index $WASM_SRC & pids+=($!)

./download-canister-wasm-dfx.sh event_store  & pids+=($!)
./download-canister-wasm-dfx.sh sign_in_with_ethereum & pids+=($!)
./download-canister-wasm-dfx.sh sign_in_with_solana & pids+=($!)

for pid in ${pids[@]}; do
   wait $pid || { echo "Failed to download all wasms"; exit 1; }
done

echo "Wasms downloaded"