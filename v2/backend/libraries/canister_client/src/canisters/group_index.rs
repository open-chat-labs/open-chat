use crate::utils::delay;
use candid::{Decode, Encode, Principal};
use group_index_canister::*;
use ic_agent::Agent;

// Queries
generate_query_call!(active_groups);

// Updates
generate_update_call!(c2c_create_group);
generate_update_call!(c2c_mark_active);
