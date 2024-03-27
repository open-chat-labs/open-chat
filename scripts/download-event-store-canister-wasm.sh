#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

dfx build --ic event_store
cp .dfx/ic/canisters/event_store/event_store.wasm.gz wasms