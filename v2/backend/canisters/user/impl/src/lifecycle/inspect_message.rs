use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::inspect_message;
use user_canister::add_webrtc_endpoint;

#[inspect_message]
fn inspect_message() {
    RUNTIME_STATE.with(|state| try_accept(state.borrow().as_ref().unwrap()));
}

fn try_accept(runtime_state: &RuntimeState) {
    // All valid ingress messages are either:
    // 1. calls to 'deposit_cycles'
    // 2. calls to add a webrtc endpoint from a user with whom the owner has a direct chat
    // 3. from the owner

    let method_name = ic_cdk::api::call::method_name();

    let acceptable = match method_name.as_str() {
        "deposit_cycles" => true,
        "add_webrtc_endpoint" => {
            let (args,) = ic_cdk::api::call::arg_data::<(add_webrtc_endpoint::Args,)>();
            runtime_state.data.direct_chats.exists(args.endpoint.user_id)
        }
        _ => runtime_state.is_caller_owner(),
    };

    if acceptable {
        ic_cdk::api::call::accept_message();
    }
}
