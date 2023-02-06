### Deploy

`dfx canister create group_prize_bot --no-wallet --with-cycles 20000000000000`
`dfx deploy group_prize_bot --no-wallet --argument '(record { user_index_canister_id = principal "qvhpv-4qaaa-aaaaa-aaagq-cai"; admins = vec { principal "347of-sq6dc-h53df-dtzkw-eama6-hfaxk-a7ghn-oumsd-jf2qy-tqvqc-wqe" }; wasm_version = record { major = 0; minor = 0; patch = 0 }; test_mode = true })'`

### Register bot

`dfx canister --network=ic_test call group_prize_bot initialize_bot '(record { username = "BitcoinBot", token = "CKBTC", ledger_canister_id = "mxzaz-hqaaa-aaaar-qaada-cai", min_individual_prize = 5000:nat64, max_individual_prize = 500000:nat64, min_claimants_per_message = 20:nat32, max_claimants_per_message = 100:nat32, end_date = 1677258000000:nat64, groups = vec { principal "j4itr-ryaaa-aaaaf-agzpq-cai", principal "4g7vh-qyaaa-aaaaf-ab2iq-cai"} })'`
