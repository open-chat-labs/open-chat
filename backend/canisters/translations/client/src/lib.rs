use canister_client::{generate_candid_query_call, generate_candid_update_call};
use translations_canister::*;

// Queries
generate_candid_query_call!(pending_deployment);

// Updates
generate_candid_update_call!(mark_deployed);
