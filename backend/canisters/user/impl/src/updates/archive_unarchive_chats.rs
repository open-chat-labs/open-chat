use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::archive_unarchive_chats::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn archive_unarchive_chats(args: Args) -> Response {
    execute_update(|state| archive_unarchive_chats_impl(args, state))
}

fn archive_unarchive_chats_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    user_core::updates::archive_unarchive_chats::archive_unarchive_chats(&mut state.data.user, args, now)
}
