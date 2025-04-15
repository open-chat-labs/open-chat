use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{icrc1::Account, CanisterId, EmptySuccessOrError, Milliseconds, PinNumberWrapper};

#[ts_export(user, approve_transfer)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub spender: Account,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub expires_in: Option<Milliseconds>,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = EmptySuccessOrError;
