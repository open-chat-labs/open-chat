use candid::CandidType;
use serde::Deserialize;
use types::{
    CanisterCreationStatus, CanisterUpgradeStatus, CryptocurrencyAccount, Cycles, PhoneNumber, TimestampMillis, UserId,
};

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
pub struct UnconfirmedResult {
    pub state: UnconfirmedUserState,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum UnconfirmedUserState {
    PhoneNumber(UnconfirmedPhoneNumberState),
    CyclesFee(UnconfirmedCyclesFeeState),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UnconfirmedPhoneNumberState {
    pub phone_number: PhoneNumber,
    pub valid_until: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UnconfirmedCyclesFeeState {
    pub amount: Cycles,
    pub valid_until: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ConfirmedPendingUsernameResult {
    pub canister_creation_status: CanisterCreationStatus,
    pub confirmation_state: ConfirmationState,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ConfirmedResult {
    pub username: String,
    pub canister_creation_status: CanisterCreationStatus,
    pub confirmation_state: ConfirmationState,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum ConfirmationState {
    PhoneNumber(PhoneNumber),
    CyclesFee(Cycles),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct CreatedResult {
    pub user_id: UserId,
    pub username: String,
    pub avatar_id: Option<u128>,
    pub canister_upgrade_status: CanisterUpgradeStatus,
    pub cryptocurrency_accounts: Vec<CryptocurrencyAccount>,
}
