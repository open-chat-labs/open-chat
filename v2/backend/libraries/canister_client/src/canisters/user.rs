use crate::utils::delay;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;
use user_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(updates);

// Updates
generate_update_call!(c2c_try_add_to_group);
generate_update_call!(c2c_mark_read);
generate_update_call!(c2c_send_message);
generate_update_call!(create_group);
generate_update_call!(join_group);
generate_update_call!(mark_read);
generate_update_call!(send_message);
