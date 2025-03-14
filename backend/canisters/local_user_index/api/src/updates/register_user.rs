use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(local_user_index, register_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub referral_code: Option<String>,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
}

#[ts_export(local_user_index, register_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    RegistrationInProgress,
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
    Error(OCError),
}

#[ts_export(local_user_index, register_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: UserId,
    #[ts(as = "[u8; 32]")]
    pub icp_account: AccountIdentifier,
}
