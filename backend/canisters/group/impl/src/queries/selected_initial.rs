use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use constants::MAX_MEMBERS_PER_QUERY;
use group_canister::selected_initial::{Response::*, *};
use types::{InstalledBotDetails, OCResult};

#[query(msgpack = true)]
fn selected_initial(args: Args) -> Response {
    match read_state(|state| selected_initial_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn selected_initial_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let member = state.get_calling_member(None, false)?;
    let min_visible_message_index = member.min_visible_message_index();
    let last_updated = state.data.details_last_updated();

    let chat = &state.data.chat;
    let members = chat
        .members
        .page(None, args.max_members.map(|max| max.min(MAX_MEMBERS_PER_QUERY)));

    let bots = state
        .data
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
        latest_event_index: chat.events.main_events_reader().latest_event_index().unwrap_or_default(),
        participants: members.members,
        bots,
        webhooks: chat.webhooks(),
        basic_members: members.basic_members,
        more_members_after: members.more_members_after,
        blocked_users: chat.members.blocked(),
        invited_users: chat.invited_users.user_ids().copied().collect(),
        pinned_messages: chat.pinned_messages(min_visible_message_index),
        chat_rules: chat.rules.value.clone().into(),
    })
}
