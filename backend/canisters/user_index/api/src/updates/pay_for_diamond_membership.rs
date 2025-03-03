#![allow(deprecated)]
use candid::CandidType;
use constants::{CHAT_LEDGER_CANISTER_ID, ICP_LEDGER_CANISTER_ID};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, DiamondMembershipPlanDuration, DiamondMembershipSubscription, TimestampMillis};

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(Serialize, Deserialize, Debug)]
#[serde(from = "ArgsCombined")]
pub struct Args {
    pub duration: DiamondMembershipPlanDuration,
    pub ledger: CanisterId,
    pub expected_price_e8s: u64,
    pub recurring: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct ArgsCombined {
    duration: DiamondMembershipPlanDuration,
    token: Option<types::Cryptocurrency>,
    ledger: Option<CanisterId>,
    expected_price_e8s: u64,
    recurring: bool,
}

impl From<ArgsCombined> for Args {
    fn from(value: ArgsCombined) -> Self {
        Args {
            duration: value.duration,
            ledger: value
                .ledger
                .unwrap_or(if matches!(value.token, Some(types::Cryptocurrency::CHAT)) {
                    CHAT_LEDGER_CANISTER_ID
                } else {
                    ICP_LEDGER_CANISTER_ID
                }),
            expected_price_e8s: value.expected_price_e8s,
            recurring: value.recurring,
        }
    }
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
}

#[ts_export(user_index, pay_for_diamond_membership)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct SuccessResult {
    pub expires_at: TimestampMillis,
    pub pay_in_chat: bool,
    pub subscription: DiamondMembershipSubscription,
    pub proof_jwt: String,
}
