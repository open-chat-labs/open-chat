use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    RUNTIME_STATE.with(|state| accept_if_valid(state.borrow().as_ref().unwrap()));
}

fn accept_if_valid(runtime_state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        return;
    }

    let is_valid = match method_name.as_str() {
        "update_group_canister_wasm" => runtime_state.is_caller_service_principal(),
        _ => false,
    };

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
