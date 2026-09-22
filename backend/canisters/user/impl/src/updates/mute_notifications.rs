use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::ChatId;
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
    let now = state.env.now();
    user_core::updates::toggle_mute_notifications(&mut state.data.user, chat_id, mute, now);
    Response::Success
}
