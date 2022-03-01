use canister_client_macros::*;
use notifications_canister::*;

// Queries
generate_query_call!(latest_notification_index);
generate_query_call!(notifications);

// Updates
generate_update_call!(push_subscription);
generate_update_call!(remove_notifications);
generate_update_call!(remove_subscriptions);
