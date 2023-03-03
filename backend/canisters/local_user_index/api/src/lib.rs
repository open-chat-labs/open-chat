use candid::Principal;
use serde::{Deserialize, Serialize};
use types::nns::CryptoAmount;
use types::{
    ChatId, Cryptocurrency, DiamondMembershipPlanDuration, MessageIndex, PhoneNumber, SuspensionDuration, TimestampMillis,
    UserId,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UsernameChanged(UsernameChanged),
    PhoneNumberConfirmed(PhoneNumberConfirmed),
    StorageUpgraded(StorageUpgraded),
    UserRegistered(UserRegistered),
    SuperAdminStatusChanged(SuperAdminStatusChanged),
    MaxConcurrentCanisterUpgradesChanged(MaxConcurrentCanisterUpgradesChanged),
    UserUpgradeConcurrencyChanged(UserUpgradeConcurrencyChanged),
    UserSuspended(UserSuspended),
    UserJoinedGroup(UserJoinedGroup),
    DiamondMembershipPaymentReceived(DiamondMembershipPaymentReceived),
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
pub struct UserUpgradeConcurrencyChanged {
    pub value: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserSuspended {
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub duration: SuspensionDuration,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub as_super_admin: bool,
    pub latest_message_index: Option<MessageIndex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiamondMembershipPaymentReceived {
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub expires_at: TimestampMillis,
    pub token: Cryptocurrency,
    pub amount_e8s: u64,
    pub block_index: u64,
    pub duration: DiamondMembershipPlanDuration,
    pub recurring: bool,
}
