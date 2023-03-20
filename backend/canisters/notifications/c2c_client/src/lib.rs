use canister_client::generate_c2c_call;
use notifications_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_push_notification);
generate_c2c_call!(c2c_sync_index);
