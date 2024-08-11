use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq, TS)]
#[ts(export)]
pub enum CanisterUpgradeStatus {
    InProgress,
    NotRequired,
}
