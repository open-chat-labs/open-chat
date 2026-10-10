use crate::swap_tokens::ExchangeArgs;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{PinNumberWrapper, TokenInfo, UnitResult};

// Records a swap which the user is about to make themselves, straight from their own wallet, so that
// if it doesn't finish (eg. the user leaves part way through) it can be found again later and any
// funds left with the DEX withdrawn. The user's PIN, if they have set one, is checked first, so that
// nothing is approved for a swap made with the wrong PIN. Only the MultiUser canister implements
// this, since only its users hold their own funds.
#[ts_export(user, mark_token_swap_started)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub input_amount: u128,
    pub exchange_args: ExchangeArgs,
    pub min_output_amount: u128,
    pub pin: Option<PinNumberWrapper>,
}

pub type Response = UnitResult;
