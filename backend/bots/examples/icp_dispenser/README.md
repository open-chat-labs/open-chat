### Deploy

`dfx canister create icp_dispenser --no-wallet --with-cycles 20000000000000`
`dfx deploy icp_dispenser --no-wallet --argument '(record { user_index_canister_id = principal "qvhpv-4qaaa-aaaaa-aaagq-cai"; admins = vec { principal "347of-sq6dc-h53df-dtzkw-eama6-hfaxk-a7ghn-oumsd-jf2qy-tqvqc-wqe" }; wasm_version = record { major = 0; minor = 0; patch = 0 }; test_mode = true })'`

### Register bot

`dfx canister call icp_dispenser register_bot '(record { username = "MyCoolUsername" })'`

### Add reward codes

`dfx canister call icp_dispenser add_reward_codes '(record { reward_amount = record { e8s = 100000000 }; codes = vec { "01234"; "56789" } })'`