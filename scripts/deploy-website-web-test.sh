#!/bin/sh

# Pass in DFX identity name and website version
# eg './deploy-website-web-test.sh openchat 2.0.305'

IDENTITY=$1
export OPENCHAT_WEBSITE_VERSION=$2

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

npm run --prefix frontend build:prod

dfx --identity $IDENTITY deploy --network web_test --no-wallet website
