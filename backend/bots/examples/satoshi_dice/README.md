### Deploy

`dfx canister --network=ic create satoshi_dice --no-wallet --with-cycles 20000000000000`
`dfx canister --network=ic_test install satoshi_dice --argument '(record { user_index_canister_id = principal "7njde-waaaa-aaaaf-ab2ca-cai"; local_user_index_canister_id = principal "pecvb-tqaaa-aaaaf-bhdiq-cai"; ck_btc_ledger_canister_id = principal "mxzaz-hqaaa-aaaar-qaada-cai"; admins = vec { principal "tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae" }; wasm_version = record { major = 2:nat32; minor = 0:nat32; patch = 1:nat32 }; test_mode = true })' --wasm ../../../../wasms/satoshi_dice.wasm.gz`

### Upgrade

`dfx canister --network=ic_test install --mode upgrade satoshi_dice --argument '(record { wasm_version = record { major = 2:nat32; minor = 0:nat32; patch = 581:nat32 } })' --wasm ../../../../wasms/satoshi_dice_impl.wasm.gz`
