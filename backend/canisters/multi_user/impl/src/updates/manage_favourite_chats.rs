use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Achievement;
use user_canister::manage_favourite_chats::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn manage_favourite_chats(args: Args) -> Response {
    mutate_state(|state| manage_favourite_chats_impl(args, state))
}

fn manage_favourite_chats_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let (my_index, adding) =
        state.with_caller_user_mut(|my_index, user| (my_index, user_core::updates::manage_favourite_chats(user, args, now)));
    if adding {
        state.award_achievement_and_notify(my_index, Achievement::FavouritedChat, now);
    }
    Response::Success
}
