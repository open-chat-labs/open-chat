use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use types::CanisterId;
use user_canister::queries::*;
use user_canister::updates::*;

// Queries
generate_c2c_call!(events);
generate_c2c_call!(events_by_index);
generate_c2c_call!(updates);

// Updates
generate_c2c_call!(create_group);
generate_c2c_call!(handle_add_to_group_requested);
generate_c2c_call!(handle_mark_read);
generate_c2c_call!(handle_message_received);
generate_c2c_call!(join_group);
generate_c2c_call!(mark_read);
generate_c2c_call!(send_message);
