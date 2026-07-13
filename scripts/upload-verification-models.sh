#!/bin/bash

# Uploads + commits the face verification models to a locally deployed
# personhood_verifier canister.
# Usage: ./scripts/upload-verification-models.sh [IDENTITY] [NETWORK] [EMBEDDING_VERSION]
# EMBEDDING_VERSION must be greater than the canister's current model version
# (visible at /metrics); defaults to 1 which is correct for a fresh install.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

IDENTITY=${1:-default}
NETWORK=${2:-local}
EMBEDDING_VERSION=${3:-1}
if [ "$NETWORK" = "local" ]; then IC_URL="http://127.0.0.1:8080/"; else IC_URL="https://ic0.app/"; fi

./scripts/download-personhood-models.sh

PERSONHOOD_VERIFIER_CANISTER_ID=$(dfx canister --network $NETWORK id personhood_verifier)

cargo run --package verification_model_uploader -- \
  --url $IC_URL \
  --controller $IDENTITY \
  --personhood-verifier $PERSONHOOD_VERIFIER_CANISTER_ID \
  --models-dir ./backend/personhood_bench/models \
  --embedding-version $EMBEDDING_VERSION
