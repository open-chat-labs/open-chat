use candid::{Decode, Encode, Principal};
use canister_client_macros::*;
use group_index_canister::*;
use ic_agent::Agent;

// Queries
generate_query_call!(search);
