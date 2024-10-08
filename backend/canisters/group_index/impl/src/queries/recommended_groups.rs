use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_index_canister::recommended_groups::{Response::*, *};
use std::collections::HashSet;

#[query(candid = true, msgpack = true)]
fn recommended_groups(args: Args) -> Response {
    read_state(|state| recommended_groups_impl(args, state))
}

fn recommended_groups_impl(args: Args, state: &RuntimeState) -> Response {
    let exclusions: HashSet<_> = args.exclusions.into_iter().collect();
    let groups = state
        .data
        .cached_hot_groups
        .get(args.count as usize, &exclusions)
        .into_iter()
        .filter_map(|g| state.data.public_groups.hydrate_cached_summary(g))
        .collect();

    Success(SuccessResult { groups })
}
