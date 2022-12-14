use canister_client_macros::*;
use local_group_index_canister::*;

// Updates
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_notify_group_index_events);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_upgrade_group_canister_wasm);
