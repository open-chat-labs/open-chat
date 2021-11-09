use canister_client_macros::*;
use user_index_canister::*;

// Queries
generate_query_call!(current_user);
generate_query_call!(search);
generate_query_call!(sms_messages);
generate_query_call!(user);
generate_query_call!(users);

// Updates
generate_update_call!(confirm_phone_number);
generate_update_call!(create_canister);
generate_update_call!(mark_as_online);
generate_update_call!(remove_sms_messages);
generate_update_call!(resend_code);
generate_update_call!(set_username);
generate_update_call!(submit_phone_number);
generate_update_call!(update_user_canister_wasm);
generate_update_call!(upgrade_canister);
