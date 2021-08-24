## Build the canister wasms
pushd ../..
./generate-wasm.sh group_canister_impl
./generate-wasm.sh group_index_canister_impl
./generate-wasm.sh notifications_canister_impl
./generate-wasm.sh user_canister_impl
./generate-wasm.sh user_index_canister_impl
popd

## Make a local-bin directory and copy the canister wasms here
mkdir -p local-bin
cp ../../target/wasm32-unknown-unknown/release/*-opt.wasm local-bin/
