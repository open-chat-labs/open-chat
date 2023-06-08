use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_mark_community_active::{Response::*, *};
use types::CommunityId;

#[update_msgpack]
#[trace]
fn c2c_mark_community_active(args: Args) -> Response {
    mutate_state(|state| c2c_mark_community_active_impl(args, state))
}

fn c2c_mark_community_active_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = CommunityId::from(state.env.caller());
    let now = state.env.now();

    if let Some(g) = state.data.private_communities.get_mut(&community_id) {
        g.mark_active(now + args.duration);
    } else if let Some(g) = state.data.public_communities.get_mut(&community_id) {
        let activity = args.public_community_activity.unwrap_or_default();
        g.mark_active(now + args.duration, activity);
    } else {
        return CommunityNotFound;
    }
    Success
}
