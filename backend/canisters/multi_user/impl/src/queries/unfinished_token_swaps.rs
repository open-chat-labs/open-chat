use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use constants::MINUTE_IN_MS;
use user_canister::unfinished_token_swaps::{Response::*, *};

// How long a swap the user makes from their wallet can take, after which one which hasn't been marked
// as completed was left part way through
const SWAP_TIMEOUT: u64 = 10 * MINUTE_IN_MS;

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn unfinished_token_swaps(_args: Args) -> Response {
    read_state(|state| {
        let started_before = state.env.now().saturating_sub(SWAP_TIMEOUT);
        state.with_caller_user(|_, user| {
            Success(
                user.token_swaps
                    .unfinished_made_by_user(started_before)
                    .into_iter()
                    .map(|s| s.into())
                    .collect(),
            )
        })
    })
}
