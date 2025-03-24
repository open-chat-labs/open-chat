use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use online_users_canister::*;

// Queries
generate_c2c_call!(last_online);

// Updates
generate_candid_c2c_call!(c2c_remove_user);
