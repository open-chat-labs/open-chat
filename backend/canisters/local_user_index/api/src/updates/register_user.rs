use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub referral_code: Option<String>,
    pub public_key: Vec<u8>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    UserLimitReached,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    CyclesBalanceTooLow,
    InternalError(String),
    PublicKeyInvalid(String),
    ReferralCodeInvalid,
    ReferralCodeAlreadyClaimed,
    ReferralCodeExpired,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: UserId,
    pub icp_account: AccountIdentifier,
}
