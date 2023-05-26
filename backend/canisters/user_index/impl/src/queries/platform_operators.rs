use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::platform_operators::{Response::*, *};

#[query]
fn platform_operators(_args: Args) -> Response {
    read_state(platform_operators_impl)
}

fn platform_operators_impl(state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: state.data.platform_operators.iter().copied().collect(),
    })
}
