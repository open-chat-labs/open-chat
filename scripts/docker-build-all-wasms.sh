#!/bin/bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

./scripts/check-docker-is-running.sh || exit 1

GIT_COMMIT_ID=$(git rev-parse HEAD)

echo "CommitId: $GIT_COMMIT_ID"

rm -rf wasms
docker build --build-arg git_commit_id=$GIT_COMMIT_ID --platform linux/amd64 --target wasms --output type=local,dest=wasms . || exit 1

cd wasms
for wasm in *; do
    sha256sum "$wasm"
done
cd ..
