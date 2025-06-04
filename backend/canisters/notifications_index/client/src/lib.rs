use canister_client::{generate_query_call, generate_update_call};
use notifications_index_canister::*;

// Queries
generate_query_call!(notification_canisters);

// Updates
generate_update_call!(remove_subscriptions);
