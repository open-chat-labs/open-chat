use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::{CryptoAmount, PhoneNumber};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UserEvent {
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub phone_number: PhoneNumber,
    pub storage_acquired: u64,
    pub new_storage_limit: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub cost: CryptoAmount,
    pub storage_acquired: u64,
    pub new_storage_limit: u64,
}
