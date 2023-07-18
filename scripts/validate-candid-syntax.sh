#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

for canister_path in ./backend/*canisters/*/
do
  canister_path=${canister_path%*/}
  candid=${canister_path}/api/can.did

  if test -f "$candid"; then
    echo validating ${candid}
    didc check ${candid} || exit 1
  fi
done
