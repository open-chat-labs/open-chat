use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use chat_events::{MessageContentInternal, Reader};
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::deleted_message::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn deleted_message(args: Args) -> Response {
    match read_state(|state| deleted_message_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let my_user_id = state.env.canister_id().into();

    let chat = state.data.direct_chats.get_or_err(&args.user_id.into())?;
    let events_reader = chat.events.main_events_reader();

    let message = events_reader
        .message_internal(args.message_id.into())
        .ok_or(OCErrorCode::MessageNotFound)?;
    let deleted_by = message.deleted_by.as_ref().map(|d| d.deleted_by);

    match deleted_by {
        Some(u) if u != my_user_id => Err(OCErrorCode::InitiatorNotAuthorized.into()),
        _ => {
            if matches!(message.content, MessageContentInternal::Deleted(_)) {
                Err(OCErrorCode::MessageHardDeleted.into())
            } else {
                Ok(SuccessResult {
                    content: message.content.hydrate(Some(my_user_id)),
                })
            }
        }
    }
}
