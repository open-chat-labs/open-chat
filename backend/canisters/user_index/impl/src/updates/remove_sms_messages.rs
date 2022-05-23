use crate::guards::caller_is_sms_sender;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::remove_sms_messages::{Response::*, *};

#[update(guard = "caller_is_sms_sender")]
#[trace]
fn remove_sms_messages(args: Args) -> Response {
    mutate_state(|state| remove_sms_messages_impl(args, state))
}

fn remove_sms_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.sms_messages.remove(args.up_to_index);
    Success
}
