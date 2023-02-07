use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Cryptocurrency, DiamondMembershipDetails, DiamondMembershipPlanDuration, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub token: Cryptocurrency,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(DiamondMembershipDetails),
    CannotExtend(CannotExtendResult),
    CurrencyNotSupported,
    PriceMismatch,
    PaymentAlreadyInProgress,
    UserNotFound,
    InsufficientFunds(u64), // Returns the account balance in e8s
    TransferFailed(String),
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CannotExtendResult {
    pub diamond_membership_expires_at: TimestampMillis,
    pub can_extend_at: TimestampMillis,
}
