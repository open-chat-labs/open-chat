use canister_client_macros::*;
use group_index_canister::*;
use ic_cdk::api::call::CallResult;
use tracing::error;
use types::CanisterId;

// Queries
generate_c2c_call!(c2c_filter_groups);

// Updates
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_mark_active);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_update_group);
