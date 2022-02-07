use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::Deserialize;
use types::{CanisterCreationStatus, CanisterUpgradeStatus, PhoneNumber, TimestampMillis, UserId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    UserNotFound,
    Confirmed(ConfirmedResult),
    Created(CreatedResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UnconfirmedPhoneNumber {
    pub phone_number: PhoneNumber,
    pub valid_until: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ConfirmedResult {
    pub username: String,
    pub canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum PhoneStatus {
    None,
    Unconfirmed(UnconfirmedPhoneNumber),
    Confirmed,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct CreatedResult {
    pub user_id: UserId,
    pub username: String,
    pub avatar_id: Option<u128>,
    pub canister_upgrade_status: CanisterUpgradeStatus,
    pub wasm_version: Version,
    pub open_storage_limit_bytes: u64,
    pub phone_status: PhoneStatus,
    pub icp_account: AccountIdentifier,
}
