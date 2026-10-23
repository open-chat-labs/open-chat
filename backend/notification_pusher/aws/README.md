The notification pusher runs as the ECS service `notification-pusher` in the `openchat` cluster
(us-east-1): one Fargate task, arm64, with 0.5 vCPU and 1 GB.

- **Only one pusher may run at a time,** as they keep their progress in the same DynamoDB table,
  `push_notification_stream_indexes`. The service runs one task, and a deploy stops the old task
  before starting the new one.
- **Config** is in SSM Parameter Store, which ECS passes to the task as secrets:
  - `/notification-pusher/ENV_FILE`: the pusher's `.env`, which `entrypoint.sh` writes out for it
    to read;
  - `/notification-pusher/GCLOUD_SA_JSON`: Firebase's service account.
  - The task role, `oc-notification-pusher`, gives it its AWS access, so `.env` has no AWS keys.

  To change a setting, update the parameter, then restart the task:

  ```bash
  aws ecs update-service --cluster openchat --service notification-pusher --force-new-deployment
  ```
- **Logs** are in CloudWatch, in `/oc/notification-pusher`.
- **Metrics:** the pusher writes `metrics.md` every 30 seconds, which ECS Exec can read:

  ```bash
  aws ecs execute-command --cluster openchat --container notification-pusher --interactive --command "cat /app/metrics.md" --task <task id>
  ```

### Deploying

Run the *Deploy Notifications Pusher* workflow (`.github/workflows/build-and-deploy-notifications-pusher.yaml`)
by hand, on master to deploy the latest notification pusher tag, or on a tag made after the move to
ECS to deploy that one. It:

1. builds the tag's pusher as a static arm64 binary, on an arm runner;
2. builds the image with `Dockerfile` and `entrypoint.sh`, from master;
3. pushes it to ECR's `notification-pusher`, tagged with the version and `latest`;
4. deploys `task-definition.json` with that image.

### To build by hand

In an arm64 Linux container, eg. Docker on an Apple silicon Mac, from the repo's root:

```bash
docker run --rm --platform linux/arm64 -v "$PWD":/src -w /src rust:1.99.0-bookworm bash -c 'apt-get update && apt-get install -y musl-tools && rustup target add aarch64-unknown-linux-musl && cargo build --package notification_pusher_aws --release --target aarch64-unknown-linux-musl'
```

The binary is `target/aarch64-unknown-linux-musl/release/notification_pusher_aws`. Copy it beside
`Dockerfile` and `entrypoint.sh` to build the image.
