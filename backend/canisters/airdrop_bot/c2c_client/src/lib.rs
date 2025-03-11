use airdrop_bot_canister::*;
use canister_client::generate_c2c_call;

// Updates
generate_c2c_call!(c2c_online_users, 60);
