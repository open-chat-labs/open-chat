use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::selected_initial::{Response::*, *};
use std::collections::HashSet;
use types::{InstalledBotDetails, OCResult};

#[query(candid = true, msgpack = true)]
fn selected_initial(args: Args) -> Response {
    match read_state(|state| selected_initial_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn selected_initial_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    let data = &state.data;
    data.verify_is_accessible(caller, args.invite_code)?;

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
    for user_id in data.members.iter_member_ids() {
        if non_basic_members.contains(&user_id) {
            if let Some(member) = data.members.get_by_user_id(&user_id) {
                members.push(member.into());
            }
        } else {
            basic_members.push(user_id);
        }
    }

    let bots = data
        .bots
        .iter()
        .map(|(user_id, bot)| InstalledBotDetails {
            user_id: *user_id,
            added_by: bot.added_by,
            permissions: bot.permissions.clone(),
            autonomous_permissions: bot.autonomous_permissions.clone(),
        })
        .collect();

    let api_keys = data.bot_api_keys.generated_since(0);

    Ok(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: data.events.latest_event_index(),
        members,
        bots,
        api_keys,
        basic_members,
        blocked_users: data.members.blocked(),
        invited_users: data.invited_users.users(),
        chat_rules: data.rules.value.clone().into(),
        user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
        referrals,
        public_channel_list_updated: state.data.public_channel_list_updated,
    })
}
