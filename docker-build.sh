#!/bin/sh

docker build -t openchat .

container_id=$(docker create openchat)
rm -r wasms
docker cp $container_id:/build/wasms wasms
docker rm --volumes $container_id

cd wasms
for wasm in *; do
    shasum -a 256 "$wasm"
done
cd ..