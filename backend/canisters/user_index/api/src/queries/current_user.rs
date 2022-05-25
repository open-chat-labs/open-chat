use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};
use types::{CanisterUpgradeStatus, PhoneNumber, TimestampMillis, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: UserId,
    pub username: String,
    pub avatar_id: Option<u128>,
    pub canister_upgrade_status: CanisterUpgradeStatus,
    pub wasm_version: Version,
    pub open_storage_limit_bytes: u64,
    pub phone_status: PhoneStatus,
    pub icp_account: AccountIdentifier,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum PhoneStatus {
    None,
    Unconfirmed(UnconfirmedPhoneNumber),
    Confirmed,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UnconfirmedPhoneNumber {
    pub phone_number: PhoneNumber,
    pub valid_until: TimestampMillis,
}
