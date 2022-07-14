# To build run 'docker build . -t openchat'
FROM ubuntu:22.04 as builder
SHELL ["bash", "-c"]

ARG rust_version=1.62.0

ENV TZ=UTC

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt -yq update && \
    apt -yqq install --no-install-recommends curl ca-certificates \
        build-essential libssl-dev llvm-dev liblmdb-dev clang cmake \
        git

# Install Rust and Cargo in /opt
ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/cargo/bin:/opt/cargo/bin:$PATH

RUN curl --fail https://sh.rustup.rs -sSf \
        | sh -s -- -y --default-toolchain ${rust_version}-x86_64-unknown-linux-gnu --no-modify-path && \
    rustup default ${rust_version}-x86_64-unknown-linux-gnu && \
    rustup target add wasm32-unknown-unknown

# Install IC CDK optimizer
RUN cargo install --version 0.3.4 ic-cdk-optimizer

COPY . /build
WORKDIR /build

RUN sh ./scripts/generate-wasm.sh callback_canister_impl
RUN sh ./scripts/generate-wasm.sh group_canister_impl
RUN sh ./scripts/generate-wasm.sh group_index_canister_impl
RUN sh ./scripts/generate-wasm.sh notifications_canister_impl
RUN sh ./scripts/generate-wasm.sh online_users_aggregator_canister_impl
RUN sh ./scripts/generate-wasm.sh proposals_bot_canister_impl
RUN sh ./scripts/generate-wasm.sh user_canister_impl
RUN sh ./scripts/generate-wasm.sh user_index_canister_impl
