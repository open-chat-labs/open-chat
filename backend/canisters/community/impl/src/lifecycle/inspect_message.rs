use crate::{read_state, RuntimeState};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    let is_frozen = state.data.frozen.value.is_some();

    if is_c2c_method || is_frozen {
        return;
    }

    let caller = state.env.caller();
    let is_valid = state.data.members.get(caller).is_some()
        || (state.data.invited_users.contains(&caller) && method_name == "decline_invitation");

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
