use crate::utils::delay;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;
use notifications_canister::*;

// Queries
generate_query_call!(notifications);

// Updates
generate_update_call!(push_direct_message_notification);
generate_update_call!(push_group_message_notification);
generate_update_call!(push_subscription);
generate_update_call!(push_v1direct_message_notification);
generate_update_call!(push_v1group_message_notification);
generate_update_call!(remove_notifications);
