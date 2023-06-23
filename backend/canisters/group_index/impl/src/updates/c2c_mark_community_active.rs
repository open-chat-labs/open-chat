use crate::guards::caller_is_community_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_mark_community_active::{Response::*, *};
use types::{CommunityId, Milliseconds, PublicCommunityActivity};

#[update_msgpack(guard = "caller_is_community_canister")]
#[trace]
fn c2c_mark_community_active(args: Args) -> Response {
    mutate_state(|state| c2c_mark_community_active_impl(args.duration, args.public_community_activity, state))
}

pub(crate) fn c2c_mark_community_active_impl(
    duration: Milliseconds,
    activity: Option<PublicCommunityActivity>,
    state: &mut RuntimeState,
) -> Response {
    let community_id = CommunityId::from(state.env.caller());
    let now = state.env.now();

    if let Some(c) = state.data.private_communities.get_mut(&community_id) {
        c.mark_active(now + duration);
    } else if let Some(c) = state.data.public_communities.get_mut(&community_id) {
        let activity = activity.unwrap_or_default();
        c.mark_active(now + duration, activity);
    }
    Success
}
