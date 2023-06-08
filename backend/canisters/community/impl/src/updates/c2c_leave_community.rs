use crate::{activity_notifications::handle_activity_notification, model::events::CommunityEvent, mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community::{Response::*, *};
use types::MemberLeft;

// Called via the user's user canister
#[update_msgpack]
#[trace]
fn c2c_leave_community(_args: Args) -> Response {
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

    if member.suspended.value {
        return UserSuspended;
    }

    if member.role.is_owner() && state.data.members.owner_count() == 1 {
        return LastOwnerCannotLeave;
    }

    let user_id = member.user_id;

    state.data.members.remove(&user_id);
    state.data.channels.remove_member(user_id);

    state
        .data
        .events
        .push_event(CommunityEvent::MemberLeft(Box::new(MemberLeft { user_id })), now);

    handle_activity_notification(state);

    Success
}
