#!/bin/sh

# Pass in DFX identity name and website version
# eg './deploy-website-prod.sh openchat 2.0.305'

IDENTITY=$1
VERSION=$2

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if ! cargo install --list | grep -Fq "icx-asset"
then
  cargo install icx-asset
fi

OPENCHAT_WEBSITE_VERSION=$VERSION npm run --prefix frontend build:prod

dfx --identity $IDENTITY deploy --network ic --no-wallet website
icx-asset --pem ~/.config/dfx/identity/$IDENTITY/identity.pem --replica https://ic0.app/ upload 6hsbt-vqaaa-aaaaf-aaafq-cai /.well-known/ii-alternative-origins=frontend/build/.well-known/ii-alternative-origins

