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
    dfx --identity $IDENTITY deploy --network ic_test --no-wallet website
else
  echo "npm run --prefix frontend deploy:prod_test - failed"
fi


