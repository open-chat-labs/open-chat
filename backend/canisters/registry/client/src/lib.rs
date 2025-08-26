use canister_client::{generate_candid_query_call, generate_candid_update_call};
use registry_canister::*;

// Queries
generate_candid_query_call!(subnets);

// Updates
generate_candid_update_call!(add_token);
generate_candid_update_call!(expand_onto_subnet);
