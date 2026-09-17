use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{ChatId, Timestamped};
use user_canister::mute_notifications::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn mute_notifications(args: Args) -> Response {
    mutate_state(|state| toggle_mute_notifications_impl(args.chat_id, true, state))
}

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn unmute_notifications(args: Args) -> Response {
    mutate_state(|state| toggle_mute_notifications_impl(args.chat_id, false, state))
}

// Only direct chats are muted here, as in the User canister: groups and channels are muted via
// their own canisters. A chat the user doesn't have is skipped.
fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    state.with_caller_user_mut(|_, user| {
        if let Some(chat) = user.direct_chats.get_mut(&chat_id) {
            chat.notifications_muted = Timestamped::new(mute, now);
        }
    });

    Response::Success
}
