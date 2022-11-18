#!/bin/sh

# Pass in DFX identity name, website version and network name
# eg './deploy-website-testnet.sh openchat 2.0.305 small06'

IDENTITY=$1
export OPENCHAT_WEBSITE_VERSION=$2
export DFX_NETWORK=$3

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

npm run --prefix frontend deploy:testnet

dfx --identity $IDENTITY deploy --network $DFX_NETWORK --no-wallet --with-cycles 100000000000000 website
