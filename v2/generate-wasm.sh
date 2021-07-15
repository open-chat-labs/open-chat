echo Building package $1
cargo build --target wasm32-unknown-unknown --release --package $1

echo Optimising wasm
wasm-opt target/wasm32-unknown-unknown/release/$1.wasm --strip-debug -Oz -o target/wasm32-unknown-unknown/release/$1-opt.wasm