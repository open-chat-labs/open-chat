use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use storage_index_canister::*;

// Queries
generate_candid_c2c_call!(allocated_bucket_v2);
generate_candid_c2c_call!(user);

// Updates
generate_c2c_call!(c2c_group_index, 300);
generate_candid_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_storage_bucket, 300);
generate_c2c_call!(c2c_user_index, 300);
generate_candid_c2c_call!(upgrade_bucket_canister_wasm);
