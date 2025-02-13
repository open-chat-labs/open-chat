use canister_client::generate_candid_update_call;
use notifications_index_canister::*;

// Queries

// Updates
generate_candid_update_call!(add_notifications_canister);
generate_candid_update_call!(push_subscription);
generate_candid_update_call!(remove_subscriptions);
generate_candid_update_call!(upgrade_notifications_canister_wasm);
