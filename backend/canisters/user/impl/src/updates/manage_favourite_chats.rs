use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Achievement;
use user_canister::manage_favourite_chats::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn manage_favourite_chats(args: Args) -> Response {
    execute_update(|state| manage_favourite_chats_impl(args, state))
}

fn manage_favourite_chats_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if user_core::updates::manage_favourite_chats(&mut state.data.user, args, now) {
        state.award_achievement_and_notify(Achievement::FavouritedChat, now);
    }
    Response::Success
}
