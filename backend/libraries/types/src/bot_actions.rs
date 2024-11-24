use crate::Chat;
use crate::{MessageId, MessageIndex};
use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotAction {
    SendTextMessage(SendTextMessageArgs),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SendTextMessageArgs {
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub text: String,
}
