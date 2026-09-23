# To build run 'docker build . -t openchat --platform linux/amd64' (or use scripts/docker-build-all-wasms.sh).
# The image is amd64 only: both the Rust toolchain and ic-wasm below are x86_64 builds.
FROM ubuntu:24.04 AS builder
SHELL ["bash", "-c"]

ARG git_commit_id
ARG rust_version=1.95.0
ARG canister_name

ENV GIT_COMMIT_ID=$git_commit_id
ENV TZ=UTC

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt -yq update && \
    apt -yqq install --no-install-recommends curl ca-certificates build-essential xz-utils

# Install Rust and Cargo in /opt
ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/cargo/bin:/opt/cargo/bin:$PATH

RUN curl --fail https://sh.rustup.rs -sSf \
        | sh -s -- -y --default-toolchain ${rust_version}-x86_64-unknown-linux-gnu --no-modify-path && \
    rustup default ${rust_version}-x86_64-unknown-linux-gnu && \
    rustup target add wasm32-unknown-unknown

# Install IC Wasm from its release binary rather than building it from source (which takes ~6 minutes).
# The checksum pins the exact binary, so every build optimises the wasms with the same tool. The
# version must match the one generate-all-canister-wasms.sh checks for, else that installs its own.
RUN curl --fail -sSL -o /tmp/ic-wasm.tar.xz https://github.com/dfinity/ic-wasm/releases/download/0.9.11/ic-wasm-x86_64-unknown-linux-gnu.tar.xz && \
    echo "5aeea4ada46748a4b69e6d97d934074a64c45da4272882412103cce110aaf86b  /tmp/ic-wasm.tar.xz" | sha256sum -c && \
    tar -xJf /tmp/ic-wasm.tar.xz -C $CARGO_HOME/bin --strip-components=1 ic-wasm-x86_64-unknown-linux-gnu/ic-wasm && \
    rm /tmp/ic-wasm.tar.xz

COPY . /build
WORKDIR /build

RUN if [[ -z "$canister_name" ]] ; then bash ./scripts/generate-all-canister-wasms.sh ; else bash ./scripts/generate-wasm.sh $canister_name ; fi
