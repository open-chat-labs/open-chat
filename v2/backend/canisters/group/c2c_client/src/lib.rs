use canister_client_macros::*;
use group_canister::*;
use ic_cdk::api::call::CallResult;
use tracing::error;
use types::CanisterId;

// Queries
generate_c2c_call!(c2c_search_messages);
generate_c2c_call!(summary);
generate_c2c_call!(summary_updates);

// Updates
generate_c2c_call!(c2c_join_group);
generate_c2c_call!(c2c_leave_group);
generate_c2c_call!(c2c_toggle_mute_notifications);
