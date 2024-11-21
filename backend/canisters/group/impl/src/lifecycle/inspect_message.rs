use crate::{read_state, RuntimeState};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        return;
    }

    let caller = state.env.caller();
    let is_valid = state.data.get_member(caller).is_some()
        || state.data.get_invitation(caller).is_some() && method_name == "decline_invitation"
        || ((method_name == "start_video_call" || method_name == "end_video_call") && state.is_caller_video_call_operator());

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
