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
    if is_c2c_method {
        return;
    }

    if state.is_caller_owner() || is_public(&method_name) {
        ic_cdk::api::call::accept_message();
    }
}

fn is_public(method_name: &str) -> bool {
    method_name == "bio" || method_name == "migrate_user_principal"
}
