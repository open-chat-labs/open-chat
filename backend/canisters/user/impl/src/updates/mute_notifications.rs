use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{ChatId, Timestamped};
use user_canister::mute_notifications::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn mute_notifications(args: Args) -> Response {
    execute_update(|state| toggle_mute_notifications_impl(args.chat_id, true, state))
}

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn unmute_notifications(args: Args) -> Response {
    execute_update(|state| toggle_mute_notifications_impl(args.chat_id, false, state))
}

fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool, state: &mut RuntimeState) -> Response {
    if let Some(direct_chat) = state.data.direct_chats.get_mut(&chat_id) {
        direct_chat.notifications_muted = Timestamped::new(mute, state.env.now());
    }

    Response::Success
}
