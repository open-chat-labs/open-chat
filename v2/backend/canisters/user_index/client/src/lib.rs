use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use shared::types::CanisterId;

pub mod queries {
    use super::*;
    use user_index_canister::queries::*;

    generate_c2c_call!(current_user);
    generate_c2c_call!(metrics);
    generate_c2c_call!(search);
    generate_c2c_call!(sms_messages);
    generate_c2c_call!(user);
    generate_c2c_call!(users);
}

pub mod updates {
    use super::*;
    use user_index_canister::updates::*;

    generate_c2c_call!(confirm_phone_number);
    generate_c2c_call!(create_canister);
    generate_c2c_call!(mark_as_online);
    generate_c2c_call!(remove_sms_messages);
    generate_c2c_call!(resend_code);
    generate_c2c_call!(set_username);
    generate_c2c_call!(submit_phone_number);
    generate_c2c_call!(update_wasm);
    generate_c2c_call!(upgrade_canister);
}
