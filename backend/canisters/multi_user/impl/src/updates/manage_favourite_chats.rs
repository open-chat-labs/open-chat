use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::manage_favourite_chats::*;
use types::Achievement;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn manage_favourite_chats(args: Args) -> Response {
    execute_update(|state| manage_favourite_chats_impl(args, state))
}

fn manage_favourite_chats_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();
    let data = &mut state.data;
    let result = data
        .users
        .with_user_mut(my_index, |user| user_core::updates::manage_favourite_chats(user, args, now))
        .expect("User not found");
    match result {
        Ok(adding) => {
            if adding {
                state.award_achievement_and_notify(my_index, Achievement::FavouritedChat, now);
            }
            Response::Success
        }
        Err(error) => Response::Error(error),
    }
}
