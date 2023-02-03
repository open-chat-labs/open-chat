### Deploy

`dfx canister create group_prize_bot --no-wallet --with-cycles 20000000000000`
`dfx deploy group_prize_bot --no-wallet --argument '(record { user_index_canister_id = principal "qvhpv-4qaaa-aaaaa-aaagq-cai"; admins = vec { principal "347of-sq6dc-h53df-dtzkw-eama6-hfaxk-a7ghn-oumsd-jf2qy-tqvqc-wqe" }; wasm_version = record { major = 0; minor = 0; patch = 0 }; test_mode = true })'`

### Register bot

`dfx canister call group_prize_bot register_bot '(record { username = "BitcoinBot" })'`

<!-- ### Add reward codes

`dfx canister call group_prize_bot add_user_ids '(record { user_ids = vec { principal "s55qq-oqaaa-aaaaa-aaakq-cai" } })'` -->