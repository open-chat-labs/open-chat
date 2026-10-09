use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::unfinished_token_swaps::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn unfinished_token_swaps(_args: Args) -> Response {
    read_state(|state| {
        state.with_caller_user(|_, user| {
            Success(
                user.token_swaps
                    .unfinished_made_by_user()
                    .into_iter()
                    .map(|s| s.into())
                    .collect(),
            )
        })
    })
}
