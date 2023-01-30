use crate::{read_state, RuntimeState};
use group_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(_args: Args) -> Response {
    read_state(selected_initial_impl)
}

fn selected_initial_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let now = runtime_state.env.now();
        let min_visible_message_index = participant.min_visible_message_index();
        let participants = &runtime_state.data.participants;

        Success(SuccessResult {
            latest_event_index: runtime_state
                .data
                .events
                .main_events_reader(now)
                .latest_event_index()
                .unwrap_or_default(),
            participants: participants.iter().map(|p| p.into()).collect(),
            blocked_users: participants.blocked(),
            pinned_messages: runtime_state
                .data
                .pinned_messages
                .iter()
                .filter(|&m| *m >= min_visible_message_index)
                .copied()
                .collect(),
            rules: runtime_state.data.rules.clone(),
        })
    } else {
        CallerNotInGroup
    }
}
