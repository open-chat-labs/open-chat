use canister_client::generate_candid_c2c_call;
use online_users_canister::*;

// Queries

// Updates
generate_candid_c2c_call!(c2c_remove_user);
