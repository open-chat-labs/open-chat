use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{nns::CryptoAmount, PhoneNumber, TimestampMillis, UserId, Version};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserIndexEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    UsernameChanged(UsernameChanged),
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
    UserRegistered(UserRegistered),
    SuperAdminStatusChanged(SuperAdminStatusChanged),
    MaxConcurrentCanisterUpgradesChanged(MaxConcurrentCanisterUpgradesChanged),
    // Use this as a one-off to initialize the first local_user_index from the user_index
    LocalUserAdded(LocalUserAdded),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsernameChanged {
    pub user_id: UserId,
    pub username: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub user_id: UserId,
    pub phone_number: PhoneNumber,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub user_id: UserId,
    pub cost: CryptoAmount,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub user_id: UserId,
    pub user_principal: Principal,
    pub username: String,
    pub is_bot: bool,
    pub referred_by: Option<UserId>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SuperAdminStatusChanged {
    pub user_id: UserId,
    pub is_super_admin: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MaxConcurrentCanisterUpgradesChanged {
    pub value: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalUserAdded {
    pub user_id: UserId,
    pub user_principal: Principal,
    pub wasm_version: Version,
    pub created: TimestampMillis,
}
