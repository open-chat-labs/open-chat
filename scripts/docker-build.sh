#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

docker build -t openchat .

container_id=$(docker create openchat)
rm -rf wasms
docker cp $container_id:/build/wasms wasms
docker rm --volumes $container_id

cd wasms
for wasm in *; do
    shasum -a 256 "$wasm"
done
cd ..
