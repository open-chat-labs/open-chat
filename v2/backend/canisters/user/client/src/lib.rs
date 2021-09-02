use candid::{Decode, Encode, Principal};
use canister_client_macros::*;
use ic_agent::Agent;
use user_canister::*;

// Queries
generate_query_call!(chunk);
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(updates);

// Updates
generate_update_call!(block_user);
generate_update_call!(create_group);
generate_update_call!(leave_group);
generate_update_call!(join_group);
generate_update_call!(mark_read);
generate_update_call!(put_chunk);
generate_update_call!(send_message);
generate_update_call!(unblock_user);
