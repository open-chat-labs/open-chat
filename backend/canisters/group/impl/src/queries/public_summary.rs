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
    let caller = runtime_state.env.caller();

    if !runtime_state.data.is_accessible(caller, args.invite_code) {
        return NotAuthorized;
    }

    let is_public = runtime_state.data.group_chat_core.is_public;
    let now = runtime_state.env.now();
    let data = &runtime_state.data;
    let events_reader = data.group_chat_core.events.main_events_reader(now);
    let latest_event_timestamp = events_reader.latest_event_timestamp().unwrap_or_default();
    let latest_event_index = events_reader.latest_event_index().unwrap_or_default();

    // You can't see private group messages unless you are a member of the group
    let latest_message = if is_public || runtime_state.data.get_member(caller).is_some() {
        events_reader.latest_message_event(None)
    } else {
        None
    };

    let summary = PublicGroupSummary {
        chat_id: runtime_state.env.canister_id().into(),
        last_updated: latest_event_timestamp,
        name: data.group_chat_core.name.clone(),
        description: data.group_chat_core.description.clone(),
        subtype: data.group_chat_core.subtype.value.clone(),
        history_visible_to_new_joiners: data.group_chat_core.history_visible_to_new_joiners,
        avatar_id: Avatar::id(&data.group_chat_core.avatar),
        latest_message,
        latest_event_index,
        participant_count: data.group_chat_core.members.len(),
        is_public,
        frozen: data.frozen.value.clone(),
        events_ttl: data.group_chat_core.events.get_events_time_to_live().value,
        gate: data.group_chat_core.gate.value.clone(),
        wasm_version: Version::default(),
    };
    Success(SuccessResult { summary })
}
