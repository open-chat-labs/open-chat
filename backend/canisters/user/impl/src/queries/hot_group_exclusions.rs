use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_canister::hot_group_exclusions::{Response::*, *};

#[query]
fn hot_group_exclusions(_args: Args) -> Response {
    read_state(hot_group_exclusions_impl)
}

fn hot_group_exclusions_impl(runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();

    Success(runtime_state.data.hot_group_exclusions.get_all(now).copied().collect())
}
