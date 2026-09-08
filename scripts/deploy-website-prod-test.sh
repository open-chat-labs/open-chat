#!/bin/bash

# Pass in DFX identity name and website version
# eg './deploy-website-prod-test.sh openchat 2.0.305'

IDENTITY=$1
export OC_WEBSITE_VERSION=$2

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

npm run --prefix frontend deploy:prod_test

if [ $? -eq 0 ]; then
    echo "npm deploy script succeeded - proceeding with dfx deploy"

    # Register the built maps with Rollbar before the assets go live, so traces from this
    # version demangle. A failed upload stops the deploy: fix it (usually the token) and rerun.
    node ./scripts/upload-source-maps.mjs $OC_WEBSITE_VERSION || exit 1
    dfx --identity $IDENTITY deploy --network ic_test --no-wallet website
else
  echo "npm run --prefix frontend deploy:prod_test - failed"
fi


