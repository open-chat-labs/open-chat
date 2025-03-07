use canister_client::generate_c2c_call;
use notifications_index_canister::*;

// Queries

// Updates
generate_c2c_call!(add_notifications_canister);
generate_c2c_call!(c2c_user_index, 60);
