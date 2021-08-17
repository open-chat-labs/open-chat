use crate::utils::delay;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;
use user_index_canister::queries::*;
use user_index_canister::updates::*;

// Queries
generate_query_call!(current_user);
generate_query_call!(metrics);
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
generate_update_call!(update_wasm);
generate_update_call!(upgrade_canister);
