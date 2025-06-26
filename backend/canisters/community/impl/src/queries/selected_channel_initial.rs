use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::selected_channel_initial::{Response::*, *};
use std::collections::HashSet;
use types::{GroupMember, OCResult};

#[query(candid = true, msgpack = true)]
fn selected_channel_initial(args: Args) -> Response {
    match read_state(|state| selected_channel_initial_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn selected_channel_initial_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, None)?;

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let user_id = state.data.members.lookup_user_id(caller);
    channel.chat.verify_is_accessible(user_id)?;

    let chat = &channel.chat;
    let last_updated = channel.details_last_updated();
    let min_visible_message_index = user_id
        .and_then(|u| chat.members.get(&u))
        .map(|m| m.min_visible_message_index())
        .unwrap_or_default();

    let mut non_basic_members = HashSet::new();
    non_basic_members.extend(chat.members.owners().iter().copied());
    non_basic_members.extend(chat.members.admins().iter().copied());
    non_basic_members.extend(chat.members.moderators().iter().copied());
    non_basic_members.extend(chat.members.lapsed().iter().copied());

    let mut members = Vec::new();
    let mut basic_members = Vec::new();
    for user_id in chat.members.member_ids().iter() {
        if non_basic_members.contains(user_id) {
            if let Some(member) = chat.members.get(user_id) {
                members.push(GroupMember::from(&member));
            }
        } else {
            basic_members.push(*user_id);
        }
    }

    Ok(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: chat.events.latest_event_index().unwrap_or_default(),
        members,
        basic_members,
        blocked_users: chat.members.blocked(),
        invited_users: chat.invited_users.user_ids().copied().collect(),
        pinned_messages: chat.pinned_messages(min_visible_message_index),
        chat_rules: chat.rules.value.clone().into(),
        webhooks: chat.webhooks(),
    })
}
