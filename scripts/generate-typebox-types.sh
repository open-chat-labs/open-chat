#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/validate-candid-matches-rust.sh

cargo run -p ts_exporter

cd frontend/openchat-agent

npm run typebox

awk '{sub(/import { Type, Static }/,"import { Type, type Static }")}1' ./src/typebox.ts > ./tmp.ts
mv tmp.ts ./src/typebox.ts