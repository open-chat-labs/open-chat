#!/bin/sh

echo Building package $1
cargo build --target wasm32-unknown-unknown --release --package $1

echo Optimising wasm
if ! cargo install --list | grep -Fxq "ic-cdk-optimizer v0.3.4:"
then
  cargo install --version 0.3.4 ic-cdk-optimizer
fi
ic-cdk-optimizer ./target/wasm32-unknown-unknown/release/$1.wasm -o ./target/wasm32-unknown-unknown/release/$1-opt.wasm

echo Compressing wasm
mkdir -p wasms
gzip -fckn target/wasm32-unknown-unknown/release/$1-opt.wasm > ./wasms/$1.wasm.gz
