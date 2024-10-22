use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Achievement;
use user_canister::manage_favourite_chats::{Response::*, *};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
fn manage_favourite_chats(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let now = state.env.now();

        let adding = !args.to_add.is_empty();

        for chat in args.to_add {
            state.data.favourite_chats.add(chat, now);
        }

        for chat in args.to_remove {
            state.data.favourite_chats.remove(&chat, now);
        }

        if adding {
            state.data.award_achievement_and_notify(Achievement::FavouritedChat, now);
        }

        Success
    })
}
