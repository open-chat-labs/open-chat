# The MiniApp service's image. Build from the repo's root, as the service is part of its workspace:
#   docker build -f backend/mini_app_service/Dockerfile -t oc-mini-app-service .
FROM rust:1.99.0-bookworm AS build
WORKDIR /src
COPY . .
# The workspace's release profile is tuned for small canister wasms rather than speed
ENV CARGO_PROFILE_RELEASE_OPT_LEVEL=3 \
    CARGO_PROFILE_RELEASE_LTO=thin \
    CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
RUN cargo build --release --locked -p mini_app_service

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/mini_app_service /usr/local/bin/mini_app_service
ENV PORT=8095
EXPOSE 8095
USER nobody
ENTRYPOINT ["mini_app_service"]
