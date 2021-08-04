use group_canister::queries::*;
use group_canister::updates::*;
use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use shared::types::CanisterId;

// Queries
generate_c2c_call!(events);
generate_c2c_call!(events_by_index);

// Updates
generate_c2c_call!(join_group);
generate_c2c_call!(mark_read);
generate_c2c_call!(send_message);
