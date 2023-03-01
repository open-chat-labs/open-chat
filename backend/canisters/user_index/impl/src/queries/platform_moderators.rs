use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::platform_moderators::{Response::*, *};

#[query]
fn platform_moderators(_args: Args) -> Response {
    read_state(platform_moderators_impl)
}

fn platform_moderators_impl(runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: runtime_state.data.platform_moderators.iter().copied().collect(),
    })
}
