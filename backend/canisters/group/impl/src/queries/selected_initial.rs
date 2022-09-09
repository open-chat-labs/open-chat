use crate::{read_state, RuntimeState};
use group_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(_args: Args) -> Response {
    read_state(selected_initial_impl)
}

fn selected_initial_impl(runtime_state: &RuntimeState) -> Response {
    if !runtime_state.is_caller_participant() {
        return CallerNotInGroup;
    }

    let participants = &runtime_state.data.participants;

    Success(SuccessResult {
        latest_event_index: runtime_state.data.events.main().last().index,
        participants: participants.iter().map(|p| p.into()).collect(),
        blocked_users: participants.blocked(),
        pinned_messages: runtime_state.data.pinned_messages.clone(),
    })
}
