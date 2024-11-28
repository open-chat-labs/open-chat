use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::set_community_indexes::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_community_indexes(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_community_indexes_impl(args, state))
}

fn set_community_indexes_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    for (community_id, index) in args.indexes {
        if let Some(community) = state.data.communities.get_mut(&community_id) {
            community.index = Timestamped::new(index, now);
        }
    }
    Success
}
