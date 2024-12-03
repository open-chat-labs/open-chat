use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::selected_initial::{Response::*, *};
use std::collections::HashSet;
use types::GroupMember;

#[query(candid = true, msgpack = true)]
fn selected_initial(_args: Args) -> Response {
    read_state(selected_initial_impl)
}

fn selected_initial_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        let min_visible_message_index = member.min_visible_message_index();
        let chat = &state.data.chat;
        let last_updated = chat.details_last_updated();

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

        Success(SuccessResult {
            timestamp: last_updated,
            last_updated,
            latest_event_index: chat.events.main_events_reader().latest_event_index().unwrap_or_default(),
            participants: members,
            basic_members,
            blocked_users: chat.members.blocked(),
            invited_users: chat.invited_users.users(),
            pinned_messages: chat.pinned_messages(min_visible_message_index),
            chat_rules: chat.rules.value.clone().into(),
        })
    } else {
        CallerNotInGroup
    }
}
