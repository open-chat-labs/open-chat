#!/bin/sh

# Pass in DFX identity name and website version
# eg './deploy-website-web-test.sh openchat 2.0.305'

IDENTITY=$1
VERSION=$2

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

OPENCHAT_WEBSITE_VERSION=$VERSION npm run --prefix frontend build:prod

dfx --identity $IDENTITY deploy --network web_test --no-wallet website
