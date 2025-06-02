use canister_client::generate_candid_update_call;
use notifications_index_canister::*;

// Queries

// Updates
generate_candid_update_call!(notify_local_index_added);
generate_candid_update_call!(push_subscription);
generate_candid_update_call!(remove_subscriptions);
