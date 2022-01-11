use crate::{read_state, RuntimeState};
use group_index_canister::recommended_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn recommended_groups(args: Args) -> Response {
    read_state(|state| recommended_groups_impl(args, state))
}

fn recommended_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        groups: runtime_state.data.cached_hot_groups.get(args.count as usize),
    })
}
