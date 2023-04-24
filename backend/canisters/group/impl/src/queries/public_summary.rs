use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use chat_events::Reader;
use group_canister::public_summary::{Response::*, *};
use types::{Avatar, PublicGroupSummary, Version};

#[query_candid_and_msgpack]
fn public_summary(_args: Args) -> Response {
    read_state(public_summary_impl)
}

fn public_summary_impl(runtime_state: &RuntimeState) -> Response {
    if !runtime_state.data.is_accessible_by_non_member() {
        return NotAuthorized;
    }

    let now = runtime_state.env.now();
    let data = &runtime_state.data;
    let events_reader = runtime_state.data.events.main_events_reader(now);
    let latest_event_timestamp = events_reader.latest_event_timestamp().unwrap_or_default();
    let latest_event_index = events_reader.latest_event_index().unwrap_or_default();

    let summary = PublicGroupSummary {
        chat_id: runtime_state.env.canister_id().into(),
        last_updated: latest_event_timestamp,
        name: data.name.clone(),
        description: data.description.clone(),
        subtype: data.subtype.value.clone(),
        avatar_id: Avatar::id(&data.avatar),
        latest_message: events_reader.latest_message_event(None),
        latest_event_index,
        participant_count: data.participants.len(),
        is_public: runtime_state.data.is_public,
        frozen: runtime_state.data.frozen.value.clone(),
        events_ttl: runtime_state.data.events.get_events_time_to_live().value,
        gate: runtime_state.data.gate.value.clone(),
        wasm_version: Version::default(),
    };
    Success(SuccessResult { summary })
}
