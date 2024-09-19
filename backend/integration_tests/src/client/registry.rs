use crate::{generate_msgpack_query_call, generate_update_call};
use registry_canister::*;

// Queries
generate_msgpack_query_call!(updates);

// Updates
generate_update_call!(add_token);
generate_update_call!(update_token);
