use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::summary::{Response::*, *};
use ic_cdk_macros::query;
use types::GroupChatSummary;

#[query]
fn summary(_: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_impl(state.borrow().as_ref().unwrap()))
}

fn summary_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let summary = GroupChatSummary {
            chat_id: runtime_state.env.canister_id().into(),
            name: runtime_state.data.name.value().clone(),
            description: runtime_state.data.description.value().clone(),
            is_public: runtime_state.data.is_public,
            min_visible_message_index: participant.min_visible_message_id,
            participants: runtime_state.data.participants.iter().map(|p| p.into()).collect(),
            latest_message: runtime_state.data.events.latest_message(),
            latest_event_index: runtime_state.data.events.latest_event_index(),
            joined: participant.date_added,
            latest_read_by_me: *participant.read_up_to.value(),
        };
        Success(SuccessResult { summary })
    } else {
        NotInGroup
    }
}
