use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::selected_initial::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn selected_initial(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| selected_initial_impl(state.borrow().as_ref().unwrap()))
}

fn selected_initial_impl(runtime_state: &RuntimeState) -> Response {
    if !runtime_state.is_caller_participant() {
        return CallerNotInGroup;
    }

    let participants = &runtime_state.data.participants;

    Success(SuccessResult {
        latest_event_index: runtime_state.data.events.last().index,
        participants: participants.iter().map(|p| p.into()).collect(),
        blocked_users: participants.blocked(),
    })
}
