use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::platform_moderators_group::{Response::*, *};

#[query]
fn platform_moderators_group(_args: Args) -> Response {
    read_state(platform_moderators_group_impl)
}

fn platform_moderators_group_impl(state: &RuntimeState) -> Response {
    Success(state.data.platform_moderators_group.unwrap())
}
