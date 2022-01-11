use crate::{read_state, RuntimeState};
use group_index_canister::new_popular_and_hot::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn new_popular_and_hot(args: Args) -> Response {
    read_state(|state| new_popular_and_hot_impl(args, state))
}

fn new_popular_and_hot_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        groups: runtime_state.data.cached_hot_groups.get(args.count as usize),
    })
}
