#!/usr/bin/env bash
set -euxo pipefail
./scripts/deploy-testnet.sh
./frontend/build_testnet.sh
dfx deploy --network small12 website
