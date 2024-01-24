use crate::{generate_query_call, generate_update_call};
use identity_canister::*;

// Queries
generate_query_call!(check_principal);

// Updates
generate_update_call!(update_user_principal);
