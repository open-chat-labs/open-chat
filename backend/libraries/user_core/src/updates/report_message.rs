use crate::User;
use chat_events::{DeleteUndeleteMessagesArgs, Reader};
use oc_error_codes::OCErrorCode;
use types::{Chat, EventIndex, OCResult, TimestampMillis, UserId};
use user_canister::report_message::Args;
use user_index_canister::c2c_report_message;

// Builds the report to send the UserIndex, provided the user may report and the message exists
pub fn build_report(user: &User, args: &Args, my_user_id: UserId) -> OCResult<c2c_report_message::Args> {
    user.verify_not_suspended()?;

    let chat = user.direct_chats.get_or_err(&args.them.into())?;
    let message = chat
        .main_events_reader()
        .message(args.message_id.into(), Some(my_user_id))
        .ok_or(OCErrorCode::MessageNotFound)?;

    Ok(c2c_report_message::Args {
        reporter: my_user_id,
        chat_id: Chat::Direct(args.them.into()),
        thread_root_message_index: None,
        message,
        already_deleted: args.delete,
        is_public: false,
        csam: args.csam,
    })
}

// Deletes the reported message from the user's copy of the chat, once the report has been made
pub fn delete_reported_message(user: &mut User, args: &Args, my_user_id: UserId, now: TimestampMillis) {
    if let Some(chat) = user.direct_chats.get_mut(&args.them.into()) {
        chat.delete_messages(DeleteUndeleteMessagesArgs {
            caller: my_user_id,
            is_admin: true,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_ids: vec![args.message_id],
            now,
        });
    }
}
