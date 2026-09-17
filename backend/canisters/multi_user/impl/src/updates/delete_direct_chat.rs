use crate::guards::caller_is_owner;
use crate::jobs;
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

// Removes the caller's entry for the chat. The core is only removed with it if the other user has
// no entry pointing at it (or the chat is the caller's chat with themselves), otherwise it lives on
// for them and the caller gets it back, without the events from before, if either of them messages
// the other again (see `DirectChatCore::rejoin`).
fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(my_index) = state.caller_user_index() else {
        return Response::Error(OCErrorCode::InitiatorNotAuthorized.into());
    };
    if args.block_user {
        // TODO: Block the user once blocked users are held per user
        unimplemented!("Blocking users is not yet supported by the MultiUser canister");
    }

    let my_user_id = state.user_id(my_index);
    let chat_id = args.user_id.into();
    let Some(chat) = state
        .data
        .users
        .with_user_mut(my_index, |user| user.direct_chats.remove(&chat_id))
        .flatten()
    else {
        return Response::Error(OCErrorCode::ChatNotFound.into());
    };

    let core_still_in_use = args.user_id != my_user_id
        && state
            .user_index(args.user_id)
            .and_then(|their_index| {
                state.data.users.with_user(their_index, |user| {
                    user.direct_chats
                        .get(&my_user_id.into())
                        .is_some_and(|their_chat| their_chat.key_id == chat.key_id)
                })
            })
            .unwrap_or_default();

    if !core_still_in_use {
        let prefixes = state.data.direct_chat_cores.remove(chat.key_id);
        state.data.stable_memory_keys_to_garbage_collect.extend(prefixes);
        jobs::garbage_collect_stable_memory::start_job_if_required(&state.data);
    }

    // TODO: Record the chat as removed so that `updates` reports it, as the User canister does
    Response::Success
}
