use crate::{
    activity_notifications::handle_activity_notification, model::events::CommunityEventInternal, mutate_state,
    run_regular_jobs, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community::{Response::*, *};
use types::CommunityMemberLeft;

// Called via the user's user canister
#[update(msgpack = true)]
#[trace]
fn c2c_leave_community(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_leave_community_impl)
}

fn c2c_leave_community_impl(state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let now = state.env.now();

    let member = match state.data.members.get(caller) {
        Some(p) => p,
        None => return UserNotInCommunity,
    };

    if member.suspended().value {
        return UserSuspended;
    }

    if (member.role().is_owner() && state.data.members.owners().len() <= 1)
        || !state.data.channels.can_leave_all_channels(member.user_id)
    {
        return LastOwnerCannotLeave;
    }

    let user_id = member.user_id;

    let removed = state.data.remove_user_from_community(user_id, now);

    state.data.events.push_event(
        CommunityEventInternal::MemberLeft(Box::new(CommunityMemberLeft {
            user_id,
            referred_by: removed.and_then(|r| r.referred_by),
        })),
        now,
    );

    handle_activity_notification(state);

    Success
}
