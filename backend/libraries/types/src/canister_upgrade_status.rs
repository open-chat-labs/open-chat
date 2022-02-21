use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterUpgradeStatus {
    InProgress,
    NotRequired,
}
