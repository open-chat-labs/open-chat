use crate::{read_state, State};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    let method_name = ic_cdk::api::msg_method_name();

    if read_state(|state| is_valid(&method_name, state)) {
        ic_cdk::api::accept_message();
    }
}

fn is_valid(method_name: &str, state: &State) -> bool {
    match method_name {
        "add_canister" | "update_config" => state.is_caller_governance_principal(),
        _ => false,
    }
}
