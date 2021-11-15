use crate::model::participants::ParticipantInternal;
use crate::{RuntimeState, RUNTIME_STATE, WASM_VERSION};
use group_canister::summary::{Response::*, *};
use ic_cdk_macros::query;
use types::{Avatar, Mention, MAX_RETURNED_MENTIONS};

#[query]
fn summary(_: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_impl(state.borrow().as_ref().unwrap()))
}

fn summary_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let data = &runtime_state.data;
    if let Some(participant) = data.participants.get(caller) {
        let latest_event = runtime_state.data.events.last();
        let mentions = get_most_recent_mentions(participant);
        let summary = Summary {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated: latest_event.timestamp,
            name: data.name.clone(),
            description: data.description.clone(),
            avatar_id: Avatar::id(&data.avatar),
            is_public: data.is_public,
            min_visible_event_index: participant.min_visible_event_index(),
            min_visible_message_index: participant.min_visible_message_index(),
            latest_message: data.events.latest_message(),
            latest_event_index: latest_event.index,
            joined: participant.date_added,
            participant_count: data.participants.len(),
            role: participant.role,
            mentions,
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
        };
        Success(SuccessResult { summary })
    } else {
        CallerNotInGroup
    }
}

fn get_most_recent_mentions(participant: &ParticipantInternal) -> Vec<Mention> {
    participant
        .mentions
        .iter()
        .rev()
        .take(MAX_RETURNED_MENTIONS)
        .map(|message_index| Mention {
            message_index: *message_index,
        })
        .collect()
}
