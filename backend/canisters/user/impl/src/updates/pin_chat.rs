use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::pin_chat::*;

const MAX_PINNED_CHATS: u32 = 10;

#[update(guard = "caller_is_owner")]
#[trace]
fn pin_chat(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        if state.data.pinned_chats.len() as u32 >= MAX_PINNED_CHATS {
            Response::PinnedLimitReached(MAX_PINNED_CHATS)
        } else {
            state.data.pin_chat(args.chat_id, state.env.now());
            Response::Success
        }
    })
}
