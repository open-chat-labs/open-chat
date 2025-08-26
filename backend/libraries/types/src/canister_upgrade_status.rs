use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterUpgradeStatus {
    InProgress,
    NotRequired,
}
