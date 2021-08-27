use ic_cdk::api::call::CallResult;
use log::error;
use types::CanisterId;
use user_canister::*;
use utils::generate_c2c_call;

// Queries
generate_c2c_call!(chunk);
generate_c2c_call!(events);
generate_c2c_call!(events_by_index);
generate_c2c_call!(updates);

// Updates
generate_c2c_call!(c2c_try_add_to_group);
generate_c2c_call!(c2c_mark_read);
generate_c2c_call!(c2c_remove_from_group);
generate_c2c_call!(c2c_send_message);
generate_c2c_call!(create_group);
generate_c2c_call!(join_group);
generate_c2c_call!(mark_read);
generate_c2c_call!(put_chunk);
generate_c2c_call!(send_message);
