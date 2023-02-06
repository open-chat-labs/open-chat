use canister_client_macros::*;
use local_user_index_canister::*;

// Queries
generate_c2c_call!(c2c_can_push_notifications);
generate_c2c_call!(c2c_lookup_user);

// Updates
generate_c2c_call!(c2c_create_user);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_notify_user_index_events);
generate_c2c_call!(c2c_upgrade_user_canister_wasm);
generate_c2c_call!(join_group);
