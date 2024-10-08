use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::selected_initial::{Response::*, *};

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

        Success(SuccessResult {
            timestamp: last_updated,
            last_updated,
            latest_event_index: chat.events.main_events_reader().latest_event_index().unwrap_or_default(),
            participants: chat.members.iter().map(|p| p.into()).collect(),
            blocked_users: chat.members.blocked(),
            invited_users: chat.invited_users.users(),
            pinned_messages: chat.pinned_messages(min_visible_message_index),
            chat_rules: chat.rules.value.clone().into(),
        })
    } else {
        CallerNotInGroup
    }
}
