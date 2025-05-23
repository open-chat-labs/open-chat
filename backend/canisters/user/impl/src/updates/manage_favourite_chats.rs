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

    let adding = !args.to_add.is_empty();

    for chat in args.to_add {
        state.data.favourite_chats.add(chat, now);
    }

    for chat in args.to_remove {
        state.data.favourite_chats.remove(&chat, now);
    }

    if adding {
        state.award_achievement_and_notify(Achievement::FavouritedChat, now);
    }

    Response::Success
}
