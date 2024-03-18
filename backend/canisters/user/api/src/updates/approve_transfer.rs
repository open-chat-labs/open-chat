use candid::CandidType;
use icrc_ledger_types::{icrc1::account::Account, icrc2::approve::ApproveError};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub spender: Account,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub expires_in: Option<Milliseconds>,
    pub pin: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ApproveError(ApproveError),
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
