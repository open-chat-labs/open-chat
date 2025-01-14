use crate::{read_state, RuntimeState};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name().trim_end_matches("_msgpack").to_string();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        return;
    }

    if state.is_caller_owner()
        || method_name == "withdraw_from_icpswap"
        || ((method_name == "start_video_call" || method_name == "end_video_call") && state.is_caller_video_call_operator())
    {
        ic_cdk::api::call::accept_message();
    }
}
