use canister_client_macros::*;
use notifications_index_canister::*;

// Queries

// Updates
generate_update_call!(push_subscription);
generate_update_call!(remove_subscriptions);
