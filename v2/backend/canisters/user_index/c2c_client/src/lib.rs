use canister_client_macros::*;
use user_index_canister::*;

// Queries
generate_c2c_call!(user);

// Updates
generate_c2c_call!(c2c_mark_users_online);
generate_c2c_call!(c2c_set_avatar);
