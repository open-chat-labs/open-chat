use crate::token_swaps::TokenSwap;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

// The swaps the user started straight from their own wallet (see `mark_token_swap_started`) which
// haven't been marked as completed. Only the MultiUser canister implements this.
pub type Args = Empty;

#[ts_export(user, unfinished_token_swaps)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<TokenSwap>),
}
