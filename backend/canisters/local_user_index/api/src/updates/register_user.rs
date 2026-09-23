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
    pub email: Option<String>,
    pub referral_code: Option<String>,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    // Registers the user in a MultiUser canister rather than in a canister of their own, so that
    // both cases can be tested. Rejected outside of test mode
    #[serde(default)]
    pub use_multi_user_canister: Option<bool>,
}

#[ts_export(local_user_index, register_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    RegistrationInProgress,
    AlreadyRegistered,
    UserLimitReached,
    UsernameInvalid,
    EmailInvalid,
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
