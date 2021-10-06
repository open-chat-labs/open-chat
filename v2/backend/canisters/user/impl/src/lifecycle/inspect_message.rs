use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    RUNTIME_STATE.with(|state| try_accept(state.borrow().as_ref().unwrap()));
}

fn try_accept(runtime_state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    let acceptable = match method_name.as_str() {
        "deposit_cycles" => true,
        _ => runtime_state.is_caller_owner(),
    };

    if acceptable {
        ic_cdk::api::call::accept_message();
    }
}
