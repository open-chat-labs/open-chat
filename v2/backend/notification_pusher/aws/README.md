### Prerequisites
rustup target add x86_64-unknown-linux-musl
brew install FiloSottile/musl-cross/musl-cross
ln -s /usr/local/opt/musl-cross/bin/x86_64-linux-musl-gcc /usr/local/bin/musl-gcc

### To build
cargo build --package notification_pusher_aws --release --target=x86_64-unknown-linux-musl

### To connect to EC2
ssh -i "./backend/notification_pusher/aws/notifications_pusher.pem" ubuntu@ec2-3-88-226-210.compute-1.amazonaws.com

### To copy to EC2
scp ./target/x86_64-unknown-linux-musl/release/notification_pusher_aws ubuntu@ec2-3-88-226-210.compute-1.amazonaws.com:~/v2/notification_pusher

### To run the service
cd ~/v2/notification_pusher
nohup ./notification_pusher_aws &