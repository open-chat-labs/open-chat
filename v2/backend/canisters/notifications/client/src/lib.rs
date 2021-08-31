use candid::{Decode, Encode, Principal};
use canister_client_macros::*;
use ic_agent::Agent;
use notifications_canister::*;

// Queries
generate_query_call!(notifications);

// Updates
generate_update_call!(remove_notifications);
generate_update_call!(remove_subscriptions);
