use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::manage_favourite_chats::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn manage_favourite_chats(args: Args) -> Response {
    mutate_state(|state| manage_favourite_chats_impl(args, state))
}

fn manage_favourite_chats_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    state.with_caller_user_mut(|_, user| {
        for chat in args.to_add {
            user.favourite_chats.add(chat, now);
        }

        for chat in args.to_remove {
            user.favourite_chats.remove(&chat, now);
        }
    });

    // TODO: Award the `FavouritedChat` achievement once achievements are held per user

    Response::Success
}
