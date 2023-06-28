use crate::{generate_query_call, generate_update_call};
use registry_canister::*;

// Queries
generate_query_call!(updates);

// Updates
generate_update_call!(add_token);
