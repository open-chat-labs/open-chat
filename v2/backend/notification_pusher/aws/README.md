### Prerequisites
rustup target add x86_64-unknown-linux-musl

### To build
cargo build --package notification_pusher_aws --release --target=x86_64-unknown-linux-musl
