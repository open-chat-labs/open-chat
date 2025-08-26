use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis};

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub ledger: CanisterId,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyLifetimeDiamondMember,
    CurrencyNotSupported,
    PriceMismatch,
    PaymentAlreadyInProgress,
    UserNotFound,
    InsufficientFunds(u64), // Returns the account balance in e8s
    TransferFailed(String),
    InternalError(String),
    Error(OCError),
}

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct SuccessResult {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    pub subscription: DiamondMembershipSubscription,
    pub proof_jwt: String,
}
