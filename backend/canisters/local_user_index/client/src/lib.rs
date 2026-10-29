use canister_client::{generate_candid_query_call, generate_candid_update_call};
use local_user_index_canister::*;

// Queries
generate_candid_query_call!(latest_notification_index);
generate_candid_query_call!(notifications);

// Updates
generate_candid_update_call!(remove_notifications);
generate_candid_update_call!(send_mini_app_message);
generate_candid_update_call!(update_mini_app);
