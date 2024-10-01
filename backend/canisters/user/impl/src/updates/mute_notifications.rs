use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{ChatId, Timestamped};
use user_canister::mute_notifications::{Response::*, *};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
fn mute_notifications(args: Args) -> Response {
    toggle_mute_notifications_impl(args.chat_id, true)
}

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
fn unmute_notifications(args: Args) -> Response {
    toggle_mute_notifications_impl(args.chat_id, false)
}

fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        if let Some(direct_chat) = state.data.direct_chats.get_mut(&chat_id) {
            direct_chat.notifications_muted = Timestamped::new(mute, state.env.now());
        }
    });

    Success
}
