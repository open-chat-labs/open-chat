use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::platform_moderators::{Response::*, *};

#[query]
fn platform_moderators(_args: Args) -> Response {
    read_state(platform_moderators_impl)
}

fn platform_moderators_impl(state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: state.data.platform_moderators.iter().copied().collect(),
    })
}
