use candid::CandidType;
use serde::Deserialize;
use types::{CanisterCreationStatus, CanisterUpgradeStatus, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    UserNotFound,
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername(ConfirmedPendingUsernameResult),
    Confirmed(ConfirmedResult),
    Created(CreatedResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PhoneNumber {
    pub country_code: u16,
    pub number: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UnconfirmedResult {
    pub phone_number: PhoneNumber,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ConfirmedPendingUsernameResult {
    pub canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ConfirmedResult {
    pub username: String,
    pub canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct CreatedResult {
    pub user_id: UserId,
    pub username: String,
    pub account_balance: u128,
    pub canister_upgrade_status: CanisterUpgradeStatus,
}
