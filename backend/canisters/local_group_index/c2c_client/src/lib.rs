use canister_client_macros::*;
use local_group_index_canister::*;

// Queries
generate_c2c_call!(c2c_can_push_notifications);

// Updates
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_set_group_upgrade_concurrency);
generate_c2c_call!(c2c_set_max_concurrent_group_upgrades);
generate_c2c_call!(c2c_upgrade_group_canister_wasm);
