use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{ChatId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/platformModeratorsGroup/")]
#[serde(tag = "kind")]
pub enum Response {
    Success(ChatId),
}
