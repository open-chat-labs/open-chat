use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis, icrc1};

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub ledger: CanisterId,
    pub expected_price_e8s: u64,
    pub recurring: bool,
    // The account to pay from, defaulting to the user's own. Any other account must have approved
    // the user's canister as spender, since the payment is then pulled via ICRC-2. Recurring
    // payments always come from the user's own account - a one off approval must not silently fund
    // renewals - so this is ignored for those.
    pub from_account: Option<icrc1::Account>,
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
