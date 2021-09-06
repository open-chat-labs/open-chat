use canister_client_macros::*;
use ic_cdk::api::call::CallResult;
use log::error;
use types::CanisterId;
use user_index_canister::*;

// Queries
generate_c2c_call!(current_user);
generate_c2c_call!(metrics);
generate_c2c_call!(search);
generate_c2c_call!(sms_messages);
generate_c2c_call!(user);
generate_c2c_call!(users);

// Updates
generate_c2c_call!(confirm_phone_number);
generate_c2c_call!(create_canister);
generate_c2c_call!(mark_as_online);
generate_c2c_call!(remove_sms_messages);
generate_c2c_call!(resend_code);
generate_c2c_call!(set_username);
generate_c2c_call!(submit_phone_number);
generate_c2c_call!(update_wasm);
generate_c2c_call!(upgrade_canister);
