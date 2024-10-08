use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::deleted_message::{Response::*, *};
use group_chat_core::DeletedMessageResult;

#[query(candid = true, msgpack = true)]
fn deleted_message(args: Args) -> Response {
    read_state(|state| deleted_message_impl(args, state))
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(caller) {
        match state
            .data
            .chat
            .deleted_message(user_id, args.thread_root_message_index, args.message_id)
        {
            DeletedMessageResult::Success(content) => Success(SuccessResult { content: *content }),
            DeletedMessageResult::UserNotInGroup => CallerNotInGroup,
            DeletedMessageResult::NotAuthorized => NotAuthorized,
            DeletedMessageResult::MessageNotFound => MessageNotFound,
            DeletedMessageResult::MessageHardDeleted => MessageHardDeleted,
        }
    } else {
        CallerNotInGroup
    }
}
