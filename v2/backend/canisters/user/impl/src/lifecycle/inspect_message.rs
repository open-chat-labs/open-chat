use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    // All valid ingress messages are either from the owner or are calls to 'deposit_cycles'
    let method_name = ic_cdk::api::call::method_name();
    if &method_name[..] == "deposit_cycles" {
        ic_cdk::api::call::accept_message();
    } else {
        RUNTIME_STATE.with(|state| accept_if_owner(state.borrow().as_ref().unwrap()));
    }
}

fn accept_if_owner(runtime_state: &RuntimeState) {
    if runtime_state.is_caller_owner() {
        ic_cdk::api::call::accept_message();
    }
}
