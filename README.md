# OpenChat

https://oc.app

OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.

## Prerequisites

#### DFX 0.30.1

To install, run `DFX_VERSION=0.30.1 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"`

#### Rust

To install, run `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

#### NPM

Download from https://nodejs.org/en/download

## Testing locally

Start DFX using `dfx start --clean`

To install all the necessary canisters (OpenChat and NNS) run `./scripts/deploy-local.sh`

To run the website run `npm --prefix frontend run dev`. This process doesn't exit but watches changes to the website and rebuilds it using `vite` for fast development iteration.

Open the website at `http://localhost:5001/`.

To upgrade a canister run `./scripts/upgrade-canister-local.sh <DFX_IDENTITY_NAME> <CANISTER_NAME> <VERSION>` (eg. `./scripts/upgrade-canister-local.sh default user 1.0.0`)

To start again with a fresh install, stop DFX, then run `rm -rf .dfx`, then start from the top of these instructions again.

## Deterministic builds

We need builds to be deterministic so that code running inside a canister can be verified by comparing the
wasm hash locally with the wasm hash exposed by the IC.

You can build the OpenChat canister wasms by running `./scripts/docker-build-all-wasms.sh`

## Bots 🤖

**OpenChat** provides an ext3ensive platform to build *bots*! Bots can interact with the OpenChat DMs, groups and communities/channels, and can be a powerfull tool to supercharge your conversations, improve moderation, and provide fun ways of interaction.

If you would like to learn more, please have a look at our [Bots SDK](https://github.com/open-chat-labs/open-chat-bots)!

## License

Copyright 2024 OpenChat Labs LTD

Licensed under the AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html

---

*Our tests run fast and cheap via [RunsOn](https://runs-on.com)*
