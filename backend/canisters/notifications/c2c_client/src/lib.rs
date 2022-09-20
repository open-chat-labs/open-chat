use canister_client_macros::*;
use notifications_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_push_notification_v2);
generate_c2c_call!(c2c_update_user_principal);
