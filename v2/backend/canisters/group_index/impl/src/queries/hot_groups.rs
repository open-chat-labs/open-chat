use crate::{read_state, RuntimeState};
use group_index_canister::hot_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn hot_groups(args: Args) -> Response {
    read_state(|state| hot_groups_impl(args, state))
}

fn hot_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        groups: runtime_state.data.cached_hot_groups.get(args.count as usize),
    })
}
