use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/setModerationFlags.ts")]
pub struct Args {
    pub moderation_flags_enabled: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/setModerationFlags.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
}
