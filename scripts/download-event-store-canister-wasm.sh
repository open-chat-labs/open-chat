#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

URL=$(jq '.canisters.event_store.wasm' dfx.json)
URL=$(echo "$URL" | tr -d '"')
echo $URL

mkdir -p wasms
cd wasms

HTTP_CODE=$(curl -sOL $URL --write-out "%{http_code}")

if [[ ${HTTP_CODE} -ne 200 ]] ; then
    echo "Failed to download wasm. Response code: ${HTTP_CODE}"
    exit 1
fi

echo "Wasm downloaded"