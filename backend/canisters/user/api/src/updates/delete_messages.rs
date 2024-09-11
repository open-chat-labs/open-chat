use candid::CandidType;
use ts_export::ts_export;
use types::{MessageId, MessageIndex, UserId};

#[ts_export(user, delete_messages)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub correlation_id: u64,
}

#[ts_export(user, delete_messages)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    UserSuspended,
}
