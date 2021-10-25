use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::summary::{Response::*, *};
use ic_cdk_macros::query;
use types::Avatar;

#[query]
fn summary(_: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_impl(state.borrow().as_ref().unwrap()))
}

fn summary_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let latest_event = runtime_state.data.events.last();

        let summary = Summary {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated: latest_event.timestamp,
            name: runtime_state.data.name.clone(),
            description: runtime_state.data.description.clone(),
            avatar_id: Avatar::id(&runtime_state.data.avatar),
            is_public: runtime_state.data.is_public,
            min_visible_event_index: participant.min_visible_event_index,
            min_visible_message_index: participant.min_visible_message_index,
            latest_message: runtime_state.data.events.latest_message(),
            latest_event_index: latest_event.index,
            joined: participant.date_added,
        };
        Success(SuccessResult { summary })
    } else {
        CallerNotInGroup
    }
}
