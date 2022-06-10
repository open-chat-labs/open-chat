use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::{CryptoAmount, PhoneNumber};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UserEvent {
    UsernameChanged(UsernameChanged),
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsernameChanged {
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub phone_number: PhoneNumber,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub cost: CryptoAmount,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}
