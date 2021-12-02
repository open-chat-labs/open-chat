use canister_client_macros::*;
use notifications_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_push_added_to_group_notification);
generate_c2c_call!(c2c_push_direct_message_notification);
generate_c2c_call!(c2c_push_group_message_notification);
