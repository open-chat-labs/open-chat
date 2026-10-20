use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use storage_index_canister::*;

// Queries
generate_candid_c2c_call!(allocated_bucket_v2);
generate_candid_c2c_call!(user);

// Updates
generate_candid_c2c_call!(add_or_update_users);
generate_c2c_call!(c2c_group_index);
generate_candid_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_storage_bucket, 300);
generate_candid_c2c_call!(c2c_sync_bucket);
generate_c2c_call!(c2c_user_index);
generate_candid_c2c_call!(remove_accessors);
generate_candid_c2c_call!(remove_users);
generate_candid_c2c_call!(upgrade_bucket_canister_wasm);
