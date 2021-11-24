### Prerequisites
rustup target add x86_64-unknown-linux-musl

### To build
cargo build --package notification_pusher_aws --release --target=x86_64-unknown-linux-musl

### To connect to EC2
ssh -i "~/Downloads/notification_pusher.pem" ubuntu@ec2-3-88-226-210.compute-1.amazonaws.com

### To copy to EC2
scp Dev/open-chat/v2/target/x86_64-unknown-linux-musl/release/notification_pusher_aws ubuntu@ec2-3-88-226-210.compute-1.amazonaws.com:~/v2/notification_pusher

### To run the service
nohup ./v2/notification_pusher/notification_pusher_aws &