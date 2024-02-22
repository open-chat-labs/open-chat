use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, Message, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub reporter: UserId,
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message: Message,
    pub already_deleted: bool,
    pub is_public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyReported,
}
