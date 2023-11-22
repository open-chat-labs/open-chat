use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_canister::token_swap_status::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn token_swap_status(args: Args) -> Response {
    read_state(|state| token_swap_status_impl(args, state))
}

fn token_swap_status_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(token_swap) = state.data.token_swaps.get(args.swap_id).cloned() {
        Success(SuccessResult {
            status: token_swap.into(),
        })
    } else {
        NotFound
    }
}
