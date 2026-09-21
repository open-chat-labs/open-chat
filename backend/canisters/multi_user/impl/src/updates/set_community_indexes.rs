use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::set_community_indexes::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_community_indexes(args: Args) -> Response {
    mutate_state(|state| set_community_indexes_impl(args, state))
}

fn set_community_indexes_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| {
        for (community_id, index) in args.indexes {
            if let Some(community) = user.communities.get_mut(&community_id) {
                community.index = Timestamped::new(index, now);
            }
        }
    });
    Response::Success
}
