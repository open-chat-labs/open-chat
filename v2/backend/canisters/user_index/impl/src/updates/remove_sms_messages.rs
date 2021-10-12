use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use user_index_canister::remove_sms_messages::{Response::*, *};

#[update]
#[instrument(level = "trace", skip_all)]
fn remove_sms_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_sms_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_sms_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_sms_service() {
        runtime_state.data.sms_messages.remove(args.up_to_index);
        Success
    } else {
        NotAuthorized
    }
}
