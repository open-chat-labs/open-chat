use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::delete_direct_chat::{Response::*, *};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_direct_chat_impl(args, state))
}

fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if state.data.direct_chats.remove(args.user_id.into(), now).is_some() {
        if args.block_user {
            state.data.block_user(args.user_id, now);
        }
        Success
    } else {
        ChatNotFound
    }
}
