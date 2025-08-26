use crate::MessageIndex;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageMatch {
    pub message_index: MessageIndex,
    pub score: u32,
}
