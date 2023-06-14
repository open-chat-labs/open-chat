use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::add_remove_favourite_chats::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn add_remove_favourite_chats(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let now = state.env.now();

        for chat in args.to_add {
            state.data.favourite_chats.add(chat, now);
        }

        for chat in args.to_remove {
            state.data.favourite_chats.remove(chat, now);
        }

        Success
    })
}
