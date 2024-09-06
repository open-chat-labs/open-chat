use candid::CandidType;
use ts_export::ts_export;
use types::{Chat, EventIndex, FieldTooLongResult, MessageIndex, TimestampMillis};

#[ts_export(user, set_message_reminder)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub remind_at: TimestampMillis,
}

#[ts_export(user, set_message_reminder)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(u64),
    ReminderDateInThePast,
    NotesTooLong(FieldTooLongResult),
    UserSuspended,
}
