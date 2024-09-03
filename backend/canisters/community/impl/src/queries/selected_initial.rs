use crate::{read_state, RuntimeState};
use community_canister::selected_initial::{Response::*, *};
use ic_cdk::query;

#[query]
fn selected_initial(args: Args) -> Response {
    read_state(|state| selected_initial_impl(args, state))
}

fn selected_initial_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
    }

    let data = &state.data;
    let last_updated = data.details_last_updated();

    Success(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: data.events.latest_event_index(),
        members: data.members.iter().map(|m| m.into()).collect(),
        blocked_users: data.members.blocked(),
        invited_users: data.invited_users.users(),
        chat_rules: data.rules.clone().into(),
        user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
        referrals: data.members.referrals(caller),
    })
}
