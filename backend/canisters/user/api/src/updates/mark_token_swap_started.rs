use crate::swap_tokens::ExchangeArgs;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{TokenInfo, UnitResult};

// Records a swap which the user is about to make themselves, straight from their own wallet, so that
// if it doesn't finish (eg. the user leaves part way through) it can be found again later and any
// funds left with the DEX withdrawn. Only the MultiUser canister implements this, since only its
// users hold their own funds.
#[ts_export(user, mark_token_swap_started)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub input_amount: u128,
    pub exchange_args: ExchangeArgs,
    pub min_output_amount: u128,
}

pub type Response = UnitResult;
