#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

if [ -z "${CARGO_HOME}" ]
then
  export CARGO_HOME="${HOME}/.cargo"
fi

echo Building package $1
export RUSTFLAGS="--remap-path-prefix $(readlink -f $(dirname ${0}))=/build --remap-path-prefix ${CARGO_HOME}/bin=/cargo/bin --remap-path-prefix ${CARGO_HOME}/git=/cargo/git"
for l in $(ls ${CARGO_HOME}/registry/src/)
do
  export RUSTFLAGS="--remap-path-prefix ${CARGO_HOME}/registry/src/${l}=/cargo/registry/src/github ${RUSTFLAGS}"
done
cargo build --locked --target wasm32-unknown-unknown --release --package $1

echo Optimising wasm
if ! cargo install --list | grep -Fxq "ic-cdk-optimizer v0.3.4:"
then
  cargo install --version 0.3.4 ic-cdk-optimizer
fi
ic-cdk-optimizer ./target/wasm32-unknown-unknown/release/$1.wasm -o ./target/wasm32-unknown-unknown/release/$1-opt.wasm

echo Compressing wasm
mkdir -p wasms
gzip -fckn target/wasm32-unknown-unknown/release/$1-opt.wasm > ./wasms/$1.wasm.gz
