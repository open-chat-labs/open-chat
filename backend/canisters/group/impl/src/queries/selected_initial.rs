use crate::{read_state, RuntimeState};
use group_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(_args: Args) -> Response {
    read_state(selected_initial_impl)
}

fn selected_initial_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        let now = runtime_state.env.now();
        let min_visible_message_index = member.min_visible_message_index();
        let members = &runtime_state.data.group_chat_core.members;

        Success(SuccessResult {
            timestamp: now,
            latest_event_index: runtime_state
                .data
                .group_chat_core
                .events
                .main_events_reader(now)
                .latest_event_index()
                .unwrap_or_default(),
            participants: members.iter().map(|p| p.into()).collect(),
            blocked_users: members.blocked(),
            invited_users: runtime_state.data.invited_users.users(),
            pinned_messages: runtime_state
                .data
                .group_chat_core
                .pinned_messages
                .iter()
                .filter(|&m| *m >= min_visible_message_index)
                .copied()
                .collect(),
            rules: runtime_state.data.group_chat_core.rules.clone(),
        })
    } else {
        CallerNotInGroup
    }
}
