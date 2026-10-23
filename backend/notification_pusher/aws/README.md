### Deploying

Run the *Deploy Notifications Pusher* workflow (`.github/workflows/build-and-deploy-notifications-pusher.yaml`)
by hand: on a notification pusher tag to deploy it, or on master to deploy the latest one. It builds a
static arm64 binary on an arm runner and deploys it with `scripts/deploy-notification-pusher-prod.sh`.

The host is an arm64 (t4g) EC2 instance, at the address in the repo's `NP_EC2_HOST` secret. Each
version is in `~/notification_pusher/<version>/` with its `.env`, `latest` links to the one running,
and the `notification-pusher` systemd unit runs it. Only one pusher may run at a time, as they keep
their progress in the same DynamoDB table.

### To build by hand

In an arm64 Linux container, eg. Docker on an Apple silicon Mac, from the repo's root:

```bash
docker run --rm --platform linux/arm64 -v "$PWD":/src -w /src rust:1.99.0-bookworm bash -c 'apt-get update && apt-get install -y musl-tools && rustup target add aarch64-unknown-linux-musl && cargo build --package notification_pusher_aws --release --target aarch64-unknown-linux-musl'
```

The binary is `target/aarch64-unknown-linux-musl/release/notification_pusher_aws`.
