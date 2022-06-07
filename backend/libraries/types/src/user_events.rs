use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::PhoneNumber;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UserEvent {
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub phone_number: PhoneNumber,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub prev_limit: u64,
    pub new_limit: u64,
}
