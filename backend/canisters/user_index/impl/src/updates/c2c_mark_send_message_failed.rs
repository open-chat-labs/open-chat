use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_mark_send_message_failed::{Response::*, *};

// When sending a direct message, the message is first sent from the client's device to their own
// user canister, their canister then forwards the message on to the intended recipient's canister.
// That c2c call can fail if the recipient's canister is stopped due to it being in the middle of an
// upgrade. If that happens the user's canister will instead call c2c_mark_send_message_failed, the
// user_index will then call back into the user's canister once the recipient's canister has
// finished upgrading allowing the canister to try sending the message again.
#[update_msgpack]
#[trace]
fn c2c_mark_send_message_failed(args: Args) -> Response {
    mutate_state(|state| c2c_mark_send_message_failed_impl(args, state))
}

fn c2c_mark_send_message_failed_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_open_chat_user();

    let sender = runtime_state.env.caller().into();
    let now = runtime_state.env.now();
    runtime_state
        .data
        .failed_messages_pending_retry
        .add(sender, args.recipient, now);

    Success
}
