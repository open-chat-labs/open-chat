use crate::{read_state, RuntimeState};
use community_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(args: Args) -> Response {
    read_state(|state| selected_initial_impl(args, state))
}

fn selected_initial_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
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
