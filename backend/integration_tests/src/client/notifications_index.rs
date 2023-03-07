use crate::generate_update_call;
use notifications_index_canister::*;

// Queries

// Updates
generate_update_call!(add_notifications_canister);
generate_update_call!(push_subscription);
