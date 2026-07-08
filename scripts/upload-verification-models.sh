#!/bin/bash

# Uploads + commits the face verification models to a locally deployed
# personhood_verifier canister. Usage: ./scripts/upload-verification-models.sh [IDENTITY] [NETWORK]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

IDENTITY=${1:-default}
NETWORK=${2:-local}
if [ "$NETWORK" = "local" ]; then IC_URL="http://127.0.0.1:8080/"; else IC_URL="https://ic0.app/"; fi

./scripts/download-personhood-spike-models.sh

PERSONHOOD_VERIFIER_CANISTER_ID=$(dfx canister --network $NETWORK id personhood_verifier)

cargo run --package verification_model_uploader -- \
  --url $IC_URL \
  --controller $IDENTITY \
  --personhood-verifier $PERSONHOOD_VERIFIER_CANISTER_ID \
  --models-dir ./backend/personhood_spike/models
