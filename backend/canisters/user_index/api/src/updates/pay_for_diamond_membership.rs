use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Cryptocurrency, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub token: Cryptocurrency,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
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
pub struct SuccessResult {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    pub subscription: DiamondMembershipSubscription,
    pub proof_jwt: String,
}
