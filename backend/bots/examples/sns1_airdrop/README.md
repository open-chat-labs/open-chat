### Deploy

`dfx canister create sns1_airdrop --no-wallet --with-cycles 20000000000000`
`dfx deploy sns1_airdrop --no-wallet --argument '(record { user_index_canister_id = principal "qvhpv-4qaaa-aaaaa-aaagq-cai"; admins = vec { principal "347of-sq6dc-h53df-dtzkw-eama6-hfaxk-a7ghn-oumsd-jf2qy-tqvqc-wqe" }; wasm_version = record { major = 0; minor = 0; patch = 0 }; test_mode = true })'`

### Register bot

`dfx canister call sns1_airdrop register_bot '(record { username = "SNS1_Airdrop_Bot" })'`

### Add reward codes

`dfx canister call sns1_airdrop add_user_ids '(record { user_ids = vec { principal "s55qq-oqaaa-aaaaa-aaakq-cai" } })'`