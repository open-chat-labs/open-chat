use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::selected_initial::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn selected_initial(args: Args) -> Response {
    read_state(|state| selected_initial_impl(args, state))
}

fn selected_initial_impl(args: Args, state: &RuntimeState) -> Response {
    // Don't call `ic0.caller()` if the community is public or the invite_code is valid to maximise query caching
    if !state.data.is_public || !state.data.is_invite_code_valid(args.invite_code) {
        let caller = state.env.caller();
        if !state.data.is_accessible(caller, None) {
            return PrivateCommunity;
        }
    }

    let caller = state.env.caller();
    let data = &state.data;
    let last_updated = data.details_last_updated();
    let referrals = data
        .members
        .get(caller)
        .map_or(Vec::new(), |m| m.referrals.iter().copied().collect());

    Success(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: data.events.latest_event_index(),
        members: data.members.iter().map(|m| m.into()).collect(),
        blocked_users: data.members.blocked(),
        invited_users: data.invited_users.users(),
        chat_rules: data.rules.clone().into(),
        user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
        referrals,
    })
}
