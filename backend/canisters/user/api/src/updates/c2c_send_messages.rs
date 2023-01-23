use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, EventIndex, MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub messages: Vec<SendMessageArgs>,
    pub sender_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SendMessageArgs {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub content: MessageContent,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum C2CReplyContext {
    ThisChat(MessageId),
    OtherChat(ChatId, EventIndex),
}

impl Args {
    pub fn new(messages: Vec<SendMessageArgs>, sender_name: String) -> Args {
        Args { messages, sender_name }
    }
}
