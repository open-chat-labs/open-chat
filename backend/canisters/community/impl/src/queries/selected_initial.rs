use crate::{read_state, RuntimeState};
use community_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(_args: Args) -> Response {
    read_state(selected_initial_impl)
}

fn selected_initial_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.members.get(caller).is_none() {
        return UserNotInCommunity;
    }

    let now = state.env.now();
    let members = &state.data.members;

    Success(SuccessResult {
        timestamp: now,
        latest_event_index: state.data.events.latest_event_index(),
        members: members.iter().map(|p| p.into()).collect(),
        blocked_users: members.blocked(),
        invited_users: state.data.invited_users.users(),
        rules: state.data.rules.clone(),
    })
}
