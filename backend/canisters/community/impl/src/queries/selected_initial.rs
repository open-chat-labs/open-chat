use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::selected_initial::{Response::*, *};
use std::collections::HashSet;
use types::BotGroupDetails;

#[query(candid = true, msgpack = true)]
fn selected_initial(args: Args) -> Response {
    read_state(|state| selected_initial_impl(args, state))
}

fn selected_initial_impl(args: Args, state: &RuntimeState) -> Response {
    // Don't call `ic0.caller()` if the community is public or the invite_code is valid to maximise query caching
    if !state.data.is_public.value || !state.data.is_invite_code_valid(args.invite_code) {
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
        .map_or(Vec::new(), |m| m.referrals().iter().copied().collect());

    let mut non_basic_members = HashSet::new();
    non_basic_members.extend(data.members.owners().iter().copied());
    non_basic_members.extend(data.members.admins().iter().copied());
    non_basic_members.extend(data.members.lapsed().iter().copied());
    non_basic_members.extend(data.members.suspended().iter().copied());
    non_basic_members.extend(data.members.members_with_display_names().iter().copied());
    non_basic_members.extend(data.members.members_with_referrals().iter().copied());

    let mut members = Vec::new();
    let mut basic_members = Vec::new();
    for user_id in data.members.member_ids().iter() {
        if non_basic_members.contains(user_id) {
            if let Some(member) = data.members.get_by_user_id(user_id) {
                members.push(member.into());
            }
        } else {
            basic_members.push(*user_id);
        }
    }

    let bots = data
        .bots
        .iter()
        .map(|(user_id, config)| BotGroupDetails {
            user_id: *user_id,
            permissions: config.permissions.clone(),
        })
        .collect();

    Success(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: data.events.latest_event_index(),
        members,
        bots,
        basic_members,
        blocked_users: data.members.blocked(),
        invited_users: data.invited_users.users(),
        chat_rules: data.rules.value.clone().into(),
        user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
        referrals,
    })
}
