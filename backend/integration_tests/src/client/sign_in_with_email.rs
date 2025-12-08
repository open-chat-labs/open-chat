use crate::{generate_query_call, generate_update_call};
use sign_in_with_email_canister::*;

// Queries
generate_query_call!(get_delegation);

// Updates
generate_update_call!(generate_magic_link);
generate_update_call!(handle_magic_link);
