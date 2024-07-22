### Deploy

`dfx canister --network=ic create airdrop_bot --no-wallet --with-cycles 20000000000000`
`dfx canister --network=ic_test install airdrop_bot --argument '(record { user_index_canister_id = principal "7njde-waaaa-aaaaf-ab2ca-cai"; local_user_index_canister_id = principal "pecvb-tqaaa-aaaaf-bhdiq-cai"; ck_btc_ledger_canister_id = principal "mxzaz-hqaaa-aaaar-qaada-cai"; admins = vec { principal "tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae" }; wasm_version = record { major = 2:nat32; minor = 0:nat32; patch = 1:nat32 }; test_mode = true })' --wasm ../../../../wasms/airdrop_bot.wasm.gz`

### Upgrade

`dfx canister --network=ic_test install --mode upgrade airdrop_bot --argument '(record { wasm_version = record { major = 2:nat32; minor = 0:nat32; patch = 581:nat32 } })' --wasm ../../../../wasms/airdrop_bot_impl.wasm.gz`
