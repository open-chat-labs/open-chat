use group_index_canister::*;
use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use types::CanisterId;

// Queries
generate_c2c_call!(active_groups);

// Updates
generate_c2c_call!(create_group);
generate_c2c_call!(mark_active);
