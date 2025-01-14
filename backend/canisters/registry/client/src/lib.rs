use canister_client::{generate_query_call, generate_update_call};
use registry_canister::*;

// Queries
generate_query_call!(subnets);

// Updates
generate_update_call!(add_token);
generate_update_call!(expand_onto_subnet);
