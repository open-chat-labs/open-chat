### Deploy

`dfx canister --network=ic create group_prize_bot --no-wallet --with-cycles 20000000000000`
`dfx canister --network=ic_test install --mode reinstall group_prize_bot --argument '(record { user_index_canister_id = principal "7njde-waaaa-aaaaf-ab2ca-cai"; admins = vec { principal "tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae" }; wasm_version = record { major = 2:nat32; minor = 0:nat32; patch = 580:nat32 }; test_mode = true })' --wasm ../../../../wasms/group_prize_bot_impl.wasm.gz`

### Upgrade

`dfx canister --network=ic_test install --mode upgrade group_prize_bot --argument '(record { wasm_version = record { major = 2:nat32; minor = 0:nat32; patch = 581:nat32 } })' --wasm ../../../../wasms/group_prize_bot_impl.wasm.gz`

### Initialize bot - can also use this to re-initialize (it will skip user registration in this case)

`dfx canister --network=ic_test call group_prize_bot initialize_bot '(record { username = "BitcoinBot"; token = variant { CKBTC }; ledger_canister_id = principal "mxzaz-hqaaa-aaaar-qaada-cai"; end_date = 1675876516000:nat64; prizes = vec { vec { 50:nat64; 60:nat64; 70:nat64; 80:nat64 }; vec { 20:nat64; 50:nat64; 50:nat64; 200:nat64 }; vec { 10:nat64; 7:nat64 }; vec { 15:nat64; 23:nat64 }}})'`

### Join / leave group

`dfx canister --network=ic_test call group_prize_bot join_group '(record { add_only = false; group = principal "4g7vh-qyaaa-aaaaf-ab2iq-cai" })'`
`dfx canister --network=ic_test call group_prize_bot leave_group '(record { remove_only = false; group = principal "4g7vh-qyaaa-aaaaf-ab2iq-cai" })'`

### Start / Stop

`dfx canister --network=ic_test call group_prize_bot start '(record {})'`
`dfx canister --network=ic_test call group_prize_bot stop '(record {})'`