### Prerequisites
rustup target add x86_64-unknown-linux-musl
brew install FiloSottile/musl-cross/musl-cross
ln -s /usr/local/opt/musl-cross/bin/x86_64-linux-musl-gcc /usr/local/bin/musl-gcc

### To build
cargo build --package sms_sender_aws --release --target=x86_64-unknown-linux-musl

### To connect to EC2
ssh -i "./backend/sms_sender/aws/sms_sender.pem" ec2-user@ec2-44-202-133-70.compute-1.amazonaws.com

### To copy to EC2
scp ./target/x86_64-unknown-linux-musl/release/sms_sender_aws ec2-user@ec2-44-202-133-70.compute-1.amazonaws.com:~/sms_sender

### To run the service
cd ~/sms_sender
nohup ./sms_sender_aws &