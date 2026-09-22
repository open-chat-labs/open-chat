use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::archive_unarchive_chats::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn archive_unarchive_chats(args: Args) -> Response {
    mutate_state(|state| archive_unarchive_chats_impl(args, state))
}

fn archive_unarchive_chats_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user_core::updates::archive_unarchive_chats::archive_unarchive_chats(user, args, now))
}
