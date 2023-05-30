use crate::{read_state, RuntimeState};
use group_canister::deleted_message::{Response::*, *};
use group_chat_core::DeletedMessageResult;
use ic_cdk_macros::query;

#[query]
fn deleted_message(args: Args) -> Response {
    read_state(|state| deleted_message_impl(args, state))
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(&caller) {
        match state
            .data
            .chat
            .deleted_message(user_id, args.thread_root_message_index, args.message_id, state.env.now())
        {
            DeletedMessageResult::Success(content) => Success(SuccessResult { content: *content }),
            DeletedMessageResult::UserNotInGroup => CallerNotInGroup,
            DeletedMessageResult::NotAuthorized => NotAuthorized,
            DeletedMessageResult::MessageNotFound => MessageNotFound,
            DeletedMessageResult::MessageNotDeleted => MessageNotDeleted,
            DeletedMessageResult::MessageHardDeleted => MessageHardDeleted,
        }
    } else {
        CallerNotInGroup
    }
}
