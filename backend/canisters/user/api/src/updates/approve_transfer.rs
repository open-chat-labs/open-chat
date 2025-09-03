use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Milliseconds, PinNumberWrapper, UnitResult, icrc1::Account};

#[ts_export(user, approve_transfer)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub spender: Account,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub expires_in: Option<Milliseconds>,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
