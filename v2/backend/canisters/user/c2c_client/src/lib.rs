use canister_client_macros::*;
use ic_cdk::api::call::CallResult;
use log::error;
use types::CanisterId;
use user_canister::*;

// Updates
generate_c2c_call!(c2c_delete_messages);
generate_c2c_call!(c2c_edit_message);
generate_c2c_call!(c2c_mark_read);
generate_c2c_call!(c2c_remove_from_group);
generate_c2c_call!(c2c_send_message);
generate_c2c_call!(c2c_toggle_reaction);
generate_c2c_call!(c2c_try_add_to_group);
