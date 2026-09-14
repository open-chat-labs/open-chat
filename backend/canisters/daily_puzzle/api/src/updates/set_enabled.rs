use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

/// The one series value an operator sets at run time. Every price, reward, cap and the weekday
/// rota is a constant in the canister and changes by release (#9357).
#[ts_export(daily_puzzle, set_enabled)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub enabled: bool,
}

pub type Response = UnitResult;
