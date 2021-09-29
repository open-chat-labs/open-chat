## Testing locally

Start dfx using `dfx start`

To create and install the service canisters run `./deploy-local.sh <DFX_IDENTITY_NAME>` (eg. `./deploy-local.sh default`)

To upgrade a canister run `./upgrade-canister-local.sh <DFX_IDENTITY_NAME> <CANISTER_NAME> [VERSION]` (eg. `./upgrade-canister-local.sh default user 1.0.0`)