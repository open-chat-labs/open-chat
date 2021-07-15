#!/bin/sh

# Transform the User canister wasm into a text string of the form "123;234;12;1;45" 
wasm_blob=$(od -An -t u1 target/wasm32-unknown-unknown/release/user-opt.wasm | tr -d '\n' | sed -r -e 's/^[[:space:]]+//' -e 's/[[:space:]]+$//' -e 's/[[:space:]]+/;/g')

candid="(record { version = \"0.1.2\"; user_wasm_module = vec {$wasm_blob} })"

dfx canister call user_index update_wasm "$candid"
