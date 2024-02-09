use canister_client::{generate_query_call, generate_update_call};
use translations_canister::*;

// Queries
generate_query_call!(pending_deployment);

// Updates
generate_update_call!(mark_deployed);
