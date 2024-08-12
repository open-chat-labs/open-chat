use candid::CandidType;
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug, TS)]
#[ts(export_to = "userIndex/setUserUpgradeConcurrency.ts")]
pub struct Args {
    pub value: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export_to = "userIndex/setUserUpgradeConcurrency.ts")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
}
