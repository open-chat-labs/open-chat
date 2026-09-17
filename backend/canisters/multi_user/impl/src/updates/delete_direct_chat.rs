use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::delete_direct_chat::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    mutate_state(|state| delete_direct_chat_impl(args, state))
}

// Removes the caller's copy of the chat, as the User canister does. The other user's copy, if they
// are in this canister, is untouched.
fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();
    let now = state.env.now();

    let Some(prefixes) = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            let chat = user.direct_chats.remove(args.user_id.into(), now)?;
            if args.block_user {
                user.block_user(args.user_id, now);
            }
            Some(chat.stable_memory_key_prefixes())
        })
        .flatten()
    else {
        return Response::Error(OCErrorCode::ChatNotFound.into());
    };

    state.garbage_collect_stable_memory_keys(my_index, prefixes);

    Response::Success
}
