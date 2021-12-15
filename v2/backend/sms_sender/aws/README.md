### Prerequisites
rustup target add x86_64-unknown-linux-musl

### To build
cargo build --package sms_service --release --target=x86_64-unknown-linux-musl
