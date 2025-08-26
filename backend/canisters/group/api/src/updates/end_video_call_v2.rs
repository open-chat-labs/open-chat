use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub message_id: MessageId,
}

pub type Response = UnitResult;
