use canister_client_macros::*;
use notifications_index_canister::*;

// Queries

// Updates
generate_update_call!(add_notifications_canister);
generate_update_call!(push_subscription);
generate_update_call!(remove_subscriptions);
generate_update_call!(upgrade_notifications_canister_wasm);
