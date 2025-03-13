use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::delete_direct_chat::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_direct_chat_impl(args, state))
}

fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    match state.delete_direct_chat(args.user_id, args.block_user, now) {
        true => Success,
        false => ChatNotFound,
    }
}
