use crate::{generate_query_call, generate_update_call};
use online_users_canister::*;

// Queries
generate_query_call!(last_online);

// Updates
generate_update_call!(mark_as_online);
