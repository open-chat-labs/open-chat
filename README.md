# OpenChat

https://oc.app

OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.

## Prerequisites

#### DFX 0.25.1

To install, run `DFX_VERSION=0.25.1 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"`

#### Rust

To install, run `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

#### NPM

Download from https://nodejs.org/en/download

## Testing locally

Start DFX using `dfx start`

To install all the necessary canisters (OpenChat and NNS) run `./scripts/deploy-local.sh`

To run the website run `npm --prefix frontend run dev`. This process doesn't exit but watches changes to the website and rebuilds it using `vite` for fast development iteration.

Open the website at `http://localhost:5001/`.

To upgrade a canister run `./scripts/upgrade-canister-local.sh <DFX_IDENTITY_NAME> <CANISTER_NAME> <VERSION>` (eg. `./scripts/upgrade-canister-local.sh default user 1.0.0`)

To start again with a fresh install, stop DFX, then run `rm -rf .dfx`, then start from the top of these instructions again.

## Deterministic builds

We need builds to be deterministic so that code running inside a canister can be verified by comparing the
wasm hash locally with the wasm hash exposed by the IC.

You can build the OpenChat canister wasms by running `./scripts/docker-build-all-wasms.sh`

## Docker & bots

If you are developing bots on the Open Chat platform, you may want to download or build, and then run the _open-chat_ docker image.

This image runs the Open Chat canisters and UI within the container, therefore removing the requirement for a local installation.

### DockerHub registry

You may pull the latest _open-chat_ image from the [DockerHub](https://hub.docker.com/r/openchatlabs/open-chat/tags):

```
docker pull --platform linux/amd64 openchatlabs/open-chat:latest
```

In case you get an _unauthorised error_ when calling this command, please use `docker logout` / `docker login` to re-authorise.

> **Note:** You may be able to use _Docker Desktop_ app to download the image, but if your arch is different to `amd64` you may get an error if you try to pull the image. We are unfortunatelly unable to provide `arm64` image (yet), so we would recommend this step to be done in terminal.

### Building the image

If you would prefer to build the image yourself, make sure to position yourself at the root of this repository.

If you are running _x86/amd64_ architecture, run the following command to build the image from the repository:
```shell
docker build -t open-chat -f Dockerfile.oc .
```

Or, in case your machine is based on _arm64_ architecture, build with _buildx_ for _amd64_ platform (uses QUEMU under the bonnet):
```shell
docker buildx build -t open-chat -f Dockerfile.oc --platform linux/amd64 --load .
```

> **Note:** it may take up to 10+ minutes to build the image.

### Running the image

To run the `open-chat` image, once it's downloaded or built use either _Docker Desktop_, or from terminal:

```shell
docker run --platform linux/amd64 -d -p 5001:80 -p 8080:8080 --name open-chat openchatlabs/open-chat:latest
```

If you've built the image yourself, then the last argument should be equal to the value provided after the `-t` flag in the `docker build` command. In our build examples that value was `open-chat`.

> **Important**: It may take _up to a minute_ for the container to initialise _dfx_ and start serving OC app correctly!

Once the container is fully running, the app UI should be available on [http://localhost:5001](http://localhost:5001).

### Offchain vs Canister bots

With the offchain bots, there are no additional steps to take to get the bot connected to the OC app. It should be enough for the bot to run on another available localhost port, and for the OC app to be able to access it.

For the canister bots, make sure your `dfx.json` has the following _networks_ entry:

```
{
  ...
  "networks": {
    "local": {
      "bind": "127.0.0.1:8080",
      "type": "ephemeral",
      "replica": {
        "subnet_type": "system"
      }
    }
  },
  ...
}
```

You will still need to have the `dfx` installed locally for issuing commands, but with the _networks_ entry defined for `networks.local.bind: 127.0.0.1:8080` those commands should apply to the `dfx` instance running within the Docker _open-chat_ container.

#### Deploy a canister bot locally

If you're wondering about _how to deploy_ your canister bot locally, there are a few exmaples of deployment scripts in the [`open-chat-bots`](https://github.com/open-chat-labs/open-chat-bots/tree/main/rs/scripts) repository that you may use (with minor modifications).

## License

Copyright 2024 OpenChat Labs LTD

Licensed under the AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html

---

*Our tests run fast and cheap via [RunsOn](https://runs-on.com)*
