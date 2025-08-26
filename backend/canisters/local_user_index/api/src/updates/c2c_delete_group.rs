use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

pub type Response = UnitResult;
