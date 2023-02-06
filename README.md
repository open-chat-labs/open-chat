# OpenChat

https://oc.app

OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.

## Testing locally

You must have DFX version 0.12.0-beta.3 installed
`DFX_VERSION=0.12.0-beta.3 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"`

Start dfx using `dfx start`

To install all the necessary canisters (OpenChat, OpenStorage and NNS) run `./scripts/deploy-local.sh`

To run the website run `npm --prefix frontend run dev`

To upgrade a canister run `./scripts/upgrade-canister-local.sh <DFX_IDENTITY_NAME> <CANISTER_NAME> <VERSION>` (eg. `./scripts/upgrade-canister-local.sh default user 1.0.0`)

## Deterministic builds

We need builds to be deterministic so that code running inside a canister can be verified by comparing the
wasm hash locally with the wasm hash exposed by the IC.

You can build the OpenChat canister wasms by running `./scripts/docker-build.sh`

## License

Copyright 2023 Computism LTD

Licensed under the AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html
