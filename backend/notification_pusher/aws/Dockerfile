# The notification pusher's image, run as an ECS service on Fargate (arm64). The binary is built
# beforehand, as a static aarch64 musl binary, and copied in beside this file:
#   docker build --platform linux/arm64 -t notification-pusher <dir with the binary, this file and entrypoint.sh>
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Where the entrypoint writes the pusher's config, and the pusher its metrics.md
RUN mkdir /app && chown nobody:nogroup /app
WORKDIR /app
COPY notification_pusher_aws entrypoint.sh /usr/local/bin/
USER nobody
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
