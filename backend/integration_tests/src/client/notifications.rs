use crate::generate_query_call;
use notifications_canister::*;

// Queries
generate_query_call!(latest_notification_index);
generate_query_call!(notifications);

// Updates
