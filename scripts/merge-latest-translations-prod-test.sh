#!/bin/bash

# Pass in the dfx identity name
# eg './merge-latest-translations-local.sh openchat'

IDENTITY=${1:-default}

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

./merge-latest-translations.sh ic_test https://ic0.app/ $IDENTITY
