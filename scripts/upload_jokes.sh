#!/bin/bash

# Pass in the dfx identity name
# eg './upload_jokes.sh openchat "/Users/mattgrogan/Downloads/shortjokes.csv"'

IDENTITY=${1}
FILE_PATH=${2}

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

GREET_BOT_CANISTER_ID=$(dfx canister --network ic id greet_bot)

cargo run \
  --manifest-path backend/bots/examples/greet/loader/Cargo.toml -- \
  --greet-bot-canister-id $GREET_BOT_CANISTER_ID \
  --url https://ic0.app/ \
  --controller $IDENTITY \
  --file-path $FILE_PATH