#!/bin/sh

echo Compressing wasm
xz -fkz target/wasm32-unknown-unknown/release/$1-opt.wasm