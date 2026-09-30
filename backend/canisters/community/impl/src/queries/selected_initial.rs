use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::selected_initial::{Response::*, *};
use constants::MAX_MEMBERS_PER_QUERY;
use types::{InstalledBotDetails, OCResult};

#[query(msgpack = true)]
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

    let members = data
        .members
        .page(None, args.max_members.map(|max| max.min(MAX_MEMBERS_PER_QUERY)));

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

    Ok(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: data.events.latest_event_index(),
        members: members.members,
        bots,
        basic_members: members.basic_members,
        more_members_after: members.more_members_after,
        blocked_users: data.members.blocked(),
        invited_users: data.invited_users.users(),
        chat_rules: data.rules.value.clone().into(),
        user_groups: data.members.iter_user_groups().map(|u| u.into()).collect(),
        referrals,
        public_channel_list_updated: state.data.public_channel_list_updated,
    })
}
