use crate::model::participants::ParticipantInternal;
use crate::{read_state, GroupChatEvents};
use crate::{RuntimeState, WASM_VERSION};
use group_canister::c2c_summary::{Response::*, *};
use ic_cdk_macros::query;
use types::{Avatar, Mention, MAX_RETURNED_MENTIONS};

#[query]
fn c2c_summary(_: Args) -> Response {
    read_state(c2c_summary_impl)
}

fn c2c_summary_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let data = &runtime_state.data;
    if let Some(participant) = data.participants.get(caller) {
        let latest_event = runtime_state.data.events.last();
        let min_visible_message_index = participant.min_visible_message_index();

        let summary = Summary {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated: latest_event.timestamp,
            name: data.name.clone(),
            description: data.description.clone(),
            avatar_id: Avatar::id(&data.avatar),
            is_public: data.is_public,
            min_visible_event_index: participant.min_visible_event_index(),
            min_visible_message_index,
            latest_message: data
                .events
                .latest_message()
                .filter(|m| m.event.message_index >= min_visible_message_index),
            latest_event_index: latest_event.index,
            joined: participant.date_added,
            participant_count: data.participants.len(),
            role: participant.role,
            mentions: get_most_recent_mentions(participant, &runtime_state.data.events),
            pinned_message: runtime_state.data.pinned_message,
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
        };
        Success(SuccessResult { summary })
    } else {
        CallerNotInGroup
    }
}

fn get_most_recent_mentions(participant: &ParticipantInternal, events: &GroupChatEvents) -> Vec<Mention> {
    participant
        .mentions
        .iter()
        .rev()
        .filter_map(|message_index| events.hydrate_mention(message_index))
        .take(MAX_RETURNED_MENTIONS)
        .collect()
}
