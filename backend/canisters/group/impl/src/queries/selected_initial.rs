use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::selected_initial::{Response::*, *};
use types::{GroupMember, GroupRole};

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

        let mut members = Vec::new();
        let mut basic_members = Vec::new();
        for member in chat.members.iter().map(GroupMember::from) {
            if matches!(member.role, GroupRole::Participant) && !member.lapsed {
                basic_members.push(member.user_id);
            }
            // Once website is upgraded, only push to `members` if not added to `basic_members`
            members.push(member);
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
