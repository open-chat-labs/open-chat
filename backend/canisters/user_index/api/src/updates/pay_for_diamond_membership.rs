use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, pay_for_diamond_membership)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub token: Cryptocurrency,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, pay_for_diamond_membership)]
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
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
#[ts_export(user_index, pay_for_diamond_membership)]
pub struct SuccessResult {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    pub subscription: DiamondMembershipSubscription,
    pub proof_jwt: String,
}
