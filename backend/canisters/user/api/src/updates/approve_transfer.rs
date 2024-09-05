use candid::CandidType;
use ts_export::ts_export;
use types::{icrc1::Account, icrc2::ApproveError, CanisterId, Milliseconds};

#[ts_export(user, approve_transfer)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub spender: Account,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub expires_in: Option<Milliseconds>,
    pub pin: Option<String>,
}

#[ts_export(user, approve_transfer)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    ApproveError(ApproveError),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
