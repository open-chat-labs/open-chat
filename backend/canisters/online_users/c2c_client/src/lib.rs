use canister_client::generate_c2c_call;
use online_users_canister::*;

// Queries
generate_c2c_call!(last_online);

// Updates
generate_c2c_call!(c2c_user_index, 300);
