#!/bin/sh
set -eux

# Start replica
dfx start --clean --background

# Wait for replica to be ready
for i in {1..60}; do
    if dfx ping; then break; fi
    sleep 1
done

# Deploy canisters
./scripts/deploy-local.sh

# Stop replica
dfx stop
