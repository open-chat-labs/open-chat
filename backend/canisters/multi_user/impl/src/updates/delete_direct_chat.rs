use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use user_canister::delete_direct_chat::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    mutate_state(|state| delete_direct_chat_impl(args, state))
}

// Removes the caller's copy of the chat, as the User canister does. The other user's copy, if they
// are in this canister, is untouched.
fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();
    let now = state.env.now();

    let Some((prefixes, blocked)) = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            let chat = user.direct_chats.remove(args.user_id.into(), now)?;
            let blocked = args.block_user && user.block_user(args.user_id, now);
            Some((chat.stable_memory_key_prefixes(), blocked))
        })
        .flatten()
    else {
        return Response::Error(OCErrorCode::ChatNotFound.into());
    };

    if blocked {
        state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserBlocked(args.user_id), now);
    }
    state.garbage_collect_stable_memory_keys(my_index, prefixes);

    Response::Success
}
