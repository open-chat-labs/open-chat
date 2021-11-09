use crate::MessageIndex;
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub const MAX_RETURNED_MENTIONS: usize = 50;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Mention {
    pub message_index: MessageIndex,
}
