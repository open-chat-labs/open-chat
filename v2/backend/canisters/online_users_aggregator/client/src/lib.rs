use candid::{Decode, Encode, Principal};
use canister_client_macros::*;
use ic_agent::Agent;
use online_users_agg_canister::*;

// Updates
generate_update_call!(mark_as_online);
