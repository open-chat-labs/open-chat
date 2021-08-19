use group_index_canister::*;
use ic_cdk::api::call::CallResult;
use log::error;
use types::CanisterId;
use utils::generate_c2c_call;

// Queries
generate_c2c_call!(active_groups);

// Updates
generate_c2c_call!(create_group);
generate_c2c_call!(mark_active);
