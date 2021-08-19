use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterCreationStatus {
    Pending,
    InProgress,
    Created,
}
