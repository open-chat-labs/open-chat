use crate::ChatId;
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct GroupMatch {
    pub chat_id: ChatId,
    pub name: String,
    pub description: String,
}
