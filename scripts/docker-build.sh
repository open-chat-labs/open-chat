#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

GIT_COMMIT_ID=$(git rev-parse HEAD)

docker build -t openchat --build-arg git_commit_id=$GIT_COMMIT_ID .

container_id=$(docker create openchat)
rm -rf wasms
docker cp $container_id:/build/wasms wasms
docker rm --volumes $container_id

cd wasms
for wasm in *; do
    shasum -a 256 "$wasm"
done
cd ..
