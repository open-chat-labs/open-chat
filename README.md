# OpenChat

https://oc.app

OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.

## Prerequisites

#### DFX 0.25.1-beta.1

To install, run `DFX_VERSION=0.25.1-beta.1 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"`

#### Rust

To install, run `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

#### NPM

Download from https://nodejs.org/en/download

## Testing locally

Start DFX using `dfx start`

To install all the necessary canisters (OpenChat and NNS) run `./scripts/deploy-local.sh`

To run the website run `npm --prefix frontend run dev`

To upgrade a canister run `./scripts/upgrade-canister-local.sh <DFX_IDENTITY_NAME> <CANISTER_NAME> <VERSION>` (eg. `./scripts/upgrade-canister-local.sh default user 1.0.0`)

To start again with a fresh install, stop DFX, then run `rm -rf .dfx`, then start from the top of these instructions again.

## Deterministic builds

We need builds to be deterministic so that code running inside a canister can be verified by comparing the
wasm hash locally with the wasm hash exposed by the IC.

You can build the OpenChat canister wasms by running `./scripts/docker-build-all-wasms.sh`

## Docker & bots

If you are developing bots on the Open Chat platform, you may want to download and run the _open-chat_ docker image.

This image runs the mainnet, and Open Chat canisters and UI within the container, therefore removing the requirement for a manual local installation.

To run the `open-chat` image, once it's downloaded:
```shell
docker run -d -p 5002:80 -p 8080:8080 --name open-chat open-chat
```

NOTE: It may take up to a minute for the container to start serving OC app once it's started.

The app UI should be available on [http://localhost:5002](http://localhost:5002).

## License

Copyright 2024 OpenChat Labs LTD

Licensed under the AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html

---

*Our tests run fast and cheap via [RunsOn](https://runs-on.com)*
