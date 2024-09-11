use crate::{MessageContent, MessageIndex, UserId};
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct MessageMatch {
    pub sender: UserId,
    pub message_index: MessageIndex,
    pub content: MessageContent,
    pub score: u32,
}
