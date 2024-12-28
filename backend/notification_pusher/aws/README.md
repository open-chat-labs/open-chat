### Prerequisites
rustup target add x86_64-unknown-linux-musl
brew install FiloSottile/musl-cross/musl-cross
ln -s /usr/local/opt/musl-cross/bin/x86_64-linux-musl-gcc /usr/local/bin/musl-gcc

### To build
cargo build --package notification_pusher_aws --release --target=x86_64-unknown-linux-musl

### To connect to EC2
ssh -i "./backend/notification_pusher/aws/notification_pusher.pem" ec2-user@ec2-44-200-2-65.compute-1.amazonaws.com

### To copy to EC2
scp -i "./backend/notification_pusher/aws/notification_pusher.pem" ./target/x86_64-unknown-linux-musl/release/notification_pusher_aws ec2-user@ec2-44-200-2-65.compute-1.amazonaws.com:~/notification_pusher

### To run the service
cd ~/notification_pusher
nohup ./notification_pusher_aws &