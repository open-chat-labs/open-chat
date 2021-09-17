use crate::{CanisterId, Cycles, Version};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterCreationStatus {
    Pending,
    InProgress,
    Created,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterCreationStatusInternal {
    Pending(Option<CanisterId>),
    InProgress,
    Created(CanisterId, Version, Cycles),
}

impl From<CanisterCreationStatusInternal> for CanisterCreationStatus {
    fn from(value: CanisterCreationStatusInternal) -> Self {
        match value {
            CanisterCreationStatusInternal::Pending(_) => CanisterCreationStatus::Pending,
            CanisterCreationStatusInternal::InProgress => CanisterCreationStatus::InProgress,
            CanisterCreationStatusInternal::Created(..) => CanisterCreationStatus::Created,
        }
    }
}
