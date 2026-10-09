use crate::token_swaps::TokenSwap;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

// The swaps the user started straight from their own wallet (see `mark_token_swap_started`) which
// weren't marked as completed within 10 minutes of starting, by when they can't still be in
// progress. Only the MultiUser canister implements this.
pub type Args = Empty;

#[ts_export(user, unfinished_token_swaps)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<TokenSwap>),
}
