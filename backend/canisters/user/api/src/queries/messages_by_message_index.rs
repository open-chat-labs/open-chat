use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, MessagesResponse, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub messages: Vec<MessageIndex>,
    pub latest_known_update: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(MessagesResponse),
    ChatNotFound,
    ThreadMessageNotFound,
    ReplicaNotUpToDateV2(TimestampMillis),
}
