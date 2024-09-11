use candid::CandidType;
use ts_export::ts_export;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis};

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub token: Cryptocurrency,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Debug)]
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

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Clone, Debug, Default)]
pub struct SuccessResult {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    pub subscription: DiamondMembershipSubscription,
    pub proof_jwt: String,
}
