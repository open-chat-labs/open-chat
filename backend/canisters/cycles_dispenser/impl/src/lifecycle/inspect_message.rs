use crate::{read_state, State};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    let method_name = ic_cdk::api::call::method_name();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c");
    if is_c2c_method {
        return;
    }

    if read_state(|state| is_valid(&method_name, state)) {
        ic_cdk::api::call::accept_message();
    }
}

fn is_valid(method_name: &str, state: &State) -> bool {
    match method_name {
        "add_canister" | "set_governance_principals" | "update_config" => state.is_caller_governance_principal(),
        _ => false,
    }
}
