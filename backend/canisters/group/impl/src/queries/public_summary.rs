use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use chat_events::Reader;
use group_canister::public_summary::{Response::*, *};
use types::{Document, PublicGroupSummary, Version};

#[query_candid_and_msgpack]
fn public_summary(args: Args) -> Response {
    read_state(|state| public_summary_impl(args, state))
}

fn public_summary_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return NotAuthorized;
    }

    let is_public = state.data.chat.is_public;
    let now = state.env.now();
    let data = &state.data;
    let events_reader = data.chat.events.main_events_reader(now);
    let latest_event_timestamp = events_reader.latest_event_timestamp().unwrap_or_default();
    let latest_event_index = events_reader.latest_event_index().unwrap_or_default();

    // You can't see private group messages unless you are a member of the group
    let latest_message = if is_public || state.data.get_member(caller).is_some() {
        events_reader.latest_message_event(None)
    } else {
        None
    };

    let summary = PublicGroupSummary {
        chat_id: state.env.canister_id().into(),
        last_updated: latest_event_timestamp,
        name: data.chat.name.clone(),
        description: data.chat.description.clone(),
        subtype: data.chat.subtype.value.clone(),
        history_visible_to_new_joiners: data.chat.history_visible_to_new_joiners,
        avatar_id: Document::id(&data.chat.avatar),
        latest_message,
        latest_event_index,
        participant_count: data.chat.members.len(),
        is_public,
        frozen: data.frozen.value.clone(),
        events_ttl: data.chat.events.get_events_time_to_live().value,
        gate: data.chat.gate.value.clone(),
        wasm_version: Version::default(),
    };
    Success(SuccessResult { summary })
}
