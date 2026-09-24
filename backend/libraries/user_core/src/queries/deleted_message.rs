use crate::User;
use chat_events::{MessageContentInternal, Reader};
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId, UserIdAndPrincipal};
use user_canister::deleted_message::{Args, SuccessResult};
use utils::migrated_user_ids::MigratedUserIds;

pub fn deleted_message(
    user: &User,
    args: Args,
    my_user_id: UserId,
    migrated_user_ids: &MigratedUserIds,
) -> OCResult<SuccessResult> {
    let chat = user.direct_chats.get_or_err(&args.user_id.into())?;

    let message = chat
        .main_events_reader()
        .message_internal(args.message_id.into())
        .ok_or(OCErrorCode::MessageNotFound)?;
    let deleted_by = message.deleted_by.as_ref().map(|d| d.deleted_by);

    match deleted_by {
        // Including a message deleted under one of the user's earlier ids
        Some(u) if !migrated_user_ids.is_same_user(u, my_user_id) => Err(OCErrorCode::InitiatorNotAuthorized.into()),
        _ => {
            if matches!(message.content, MessageContentInternal::Deleted(_)) {
                Err(OCErrorCode::MessageHardDeleted.into())
            } else {
                Ok(SuccessResult {
                    content: message
                        .content
                        .hydrate(Some(UserIdAndPrincipal::new(my_user_id, user.principal))),
                })
            }
        }
    }
}
