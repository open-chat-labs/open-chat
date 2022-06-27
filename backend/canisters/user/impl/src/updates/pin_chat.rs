use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::pin_chat::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn pin_chat(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| state.data.pin_chat(args.chat_id));
    Response::Success
}
