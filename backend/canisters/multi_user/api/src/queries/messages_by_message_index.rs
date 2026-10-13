use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, MessagesResponse, TimestampMillis, UserId};

#[ts_export(user, messages_by_message_index)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub messages: Vec<MessageIndex>,
    pub latest_known_update: Option<TimestampMillis>,
}

#[ts_export(user, messages_by_message_index)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(MessagesResponse),
    Error(OCError),
}
