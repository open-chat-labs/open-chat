use crate::{read_state, RuntimeState};
use group_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(_args: Args) -> Response {
    read_state(selected_initial_impl)
}

fn selected_initial_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        let now = state.env.now();
        let min_visible_message_index = member.min_visible_message_index();
        let chat = &state.data.chat;

        Success(SuccessResult {
            timestamp: now,
            latest_event_index: chat.events.main_events_reader(now).latest_event_index().unwrap_or_default(),
            participants: chat.members.iter().map(|p| p.into()).collect(),
            blocked_users: chat.members.blocked(),
            invited_users: chat.invited_users.users(),
            pinned_messages: chat
                .pinned_messages
                .iter()
                .filter(|&m| *m >= min_visible_message_index)
                .copied()
                .collect(),
            rules: chat.rules.clone().into(),
        })
    } else {
        CallerNotInGroup
    }
}
