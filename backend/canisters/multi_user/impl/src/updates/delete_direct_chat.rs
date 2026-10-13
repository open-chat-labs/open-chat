use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update, verify_not_old_user_id};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use multi_user_canister::delete_direct_chat::*;
use oc_error_codes::OCErrorCode;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn delete_direct_chat(args: Args) -> Response {
    execute_update(|state| delete_direct_chat_impl(args, state))
}

// Removes the caller's copy of the chat. The other user's copy, if they are in this canister, is
// untouched.
fn delete_direct_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();
    let now = state.env.now();
    // The chat is deleted even if it is under a User canister's id which can't be resolved, but
    // nobody is blocked under one (see `verify_not_old_user_id`)
    let block_user = args.block_user && verify_not_old_user_id(state.data.migrated_user_ids.latest(args.user_id)).is_ok();

    let data = &mut state.data;
    let Some((prefixes, blocked)) = data
        .users
        .with_user_mut(my_index, |user| {
            let chat = user.remove_direct_chat(args.user_id, now)?;
            // Under the other user's latest id, which the chat may not be under (see `block_user`)
            let blocked = block_user
                .then(|| user.block_user(args.user_id, &data.migrated_user_ids, now))
                .flatten();
            Some((chat.stable_memory_key_prefixes(), blocked))
        })
        .flatten()
    else {
        return Response::Error(OCErrorCode::ChatNotFound.into());
    };

    if let Some(user_id) = blocked {
        state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserBlocked(user_id), now);
    }
    state.garbage_collect_stable_memory_keys(my_index, prefixes);

    Response::Success
}
