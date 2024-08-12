use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub token: Cryptocurrency,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, TS)]
#[ts(export)]
pub struct SuccessResult {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    pub subscription: DiamondMembershipSubscription,
    pub proof_jwt: String,
}
