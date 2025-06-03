use canister_client::{generate_candid_query_call, generate_candid_update_call};
use local_user_index_canister::*;

// Queries
generate_candid_query_call!(latest_notification_index);
generate_candid_query_call!(notifications_v2);

// Updates
generate_candid_update_call!(remove_notifications);
