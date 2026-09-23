use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{PinNumberWrapper, UnitResult, icrc1};

#[ts_export(user, pay_for_streak_insurance)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub additional_days: u8,
    pub expected_price: u128,
    // The account to pay from, defaulting to the user's wallet. A User canister pays from its own
    // account directly, and pulls from any other via ICRC-2, which that account must have approved.
    // A MultiUser canister's users hold their own funds, so it always pulls via ICRC-2, spending only
    // an approval made under the user's own spender subaccount (see `ledger_utils::multi_user_spender_subaccount`).
    pub from_account: Option<icrc1::Account>,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
