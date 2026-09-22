use crate::User;
use chat_events::{MessageContentInternal, Reader};
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};
use user_canister::deleted_message::{Args, SuccessResult};

pub fn deleted_message(user: &User, args: Args, my_user_id: UserId) -> OCResult<SuccessResult> {
    let chat = user.direct_chats.get_or_err(&args.user_id.into())?;

    let message = chat
        .main_events_reader()
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
