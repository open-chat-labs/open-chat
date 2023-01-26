use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use chat_events::Reader;
use group_canister::public_summary::{Response::*, *};
use types::{Avatar, PublicGroupSummary, Version};

#[query_candid_and_msgpack]
fn public_summary(args: Args) -> Response {
    read_state(|runtime_state: &RuntimeState| public_summary_impl(args, runtime_state))
}

fn public_summary_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if !runtime_state.data.is_accessible_by_non_member(args.invite_code) {
        return NotAuthorized;
    }

    let data = &runtime_state.data;
    let events_reader = runtime_state.data.events.main_events_reader();
    let latest_event = events_reader.last();

    let summary = PublicGroupSummary {
        chat_id: runtime_state.env.canister_id().into(),
        last_updated: latest_event.timestamp,
        name: data.name.clone(),
        description: data.description.clone(),
        subtype: data.subtype.value.clone(),
        avatar_id: Avatar::id(&data.avatar),
        latest_message: events_reader.latest_message_event(None),
        latest_event_index: latest_event.index,
        participant_count: data.participants.len(),
        owner_id: runtime_state.data.owner_id,
        is_public: runtime_state.data.is_public,
        frozen: runtime_state.data.frozen.value.clone(),
        wasm_version: Version::default(),
    };
    Success(SuccessResult { summary })
}
