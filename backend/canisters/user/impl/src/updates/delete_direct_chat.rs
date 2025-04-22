use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::delete_direct_chat::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_direct_chat_impl(args, state))
}

fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if state.delete_direct_chat(args.user_id, args.block_user, now) {
        Response::Success
    } else {
        Response::Error(OCErrorCode::ChatNotFound.into())
    }
}
