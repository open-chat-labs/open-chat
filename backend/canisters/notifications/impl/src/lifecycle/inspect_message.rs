use crate::{read_state, RuntimeState};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    let is_valid = match method_name.as_str() {
        "remove_notifications" => state.is_caller_push_service(),
        _ => false,
    };

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
