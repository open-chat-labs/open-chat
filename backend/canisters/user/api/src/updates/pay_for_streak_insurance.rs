use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{PinNumberWrapper, UnitResult, icrc1};

#[ts_export(user, pay_for_streak_insurance)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub additional_days: u8,
    pub expected_price: u128,
    // The account to pay from, defaulting to this canister's own. Any other account must have
    // approved this canister as spender, since the payment is then pulled via ICRC-2.
    pub from_account: Option<icrc1::Account>,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
