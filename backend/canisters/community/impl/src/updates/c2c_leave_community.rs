use crate::{model::events::CommunityEvent, mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community::{Response::*, *};
use types::{MemberLeft, UserId};

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

    let caller: UserId = state.env.caller().into();
    let now = state.env.now();

    let member = match state.data.members.get(caller.into()) {
        Some(p) => p,
        None => return CallerNotInCommunity,
    };

    if member.suspended.value {
        return UserSuspended;
    }

    if member.role.is_owner() && state.data.members.owner_count() == 1 {
        return LastOwnerCannotLeave;
    }

    state.data.members.remove(caller);

    state
        .data
        .events
        .push_event(CommunityEvent::MemberLeft(Box::new(MemberLeft { user_id: caller })), now);

    Success
}
