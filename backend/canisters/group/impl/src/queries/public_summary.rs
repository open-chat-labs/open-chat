use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use chat_events::Reader;
use group_canister::public_summary::{Response::*, *};
use types::{BuildVersion, Document, PublicGroupSummary};

#[query(candid = true, msgpack = true)]
fn public_summary(args: Args) -> Response {
    read_state(|state| public_summary_impl(args, state))
}

fn public_summary_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return NotAuthorized;
    }

    let is_public = state.data.chat.is_public.value;
    let data = &state.data;
    let events_reader = data.chat.events.main_events_reader();
    let events_ttl = data.chat.events.get_events_time_to_live();

    // You can't see private group messages unless you are a member of the group
    let latest_message = if is_public || state.data.get_member(caller).is_some() {
        events_reader.latest_message_event(None)
    } else {
        None
    };

    let summary = PublicGroupSummary {
        chat_id: state.env.canister_id().into(),
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        last_updated: events_reader.latest_event_timestamp().unwrap_or_default(),
        name: data.chat.name.value.clone(),
        description: data.chat.description.value.clone(),
        subtype: data.chat.subtype.value.clone(),
        history_visible_to_new_joiners: data.chat.history_visible_to_new_joiners,
        messages_visible_to_non_members: data.chat.messages_visible_to_non_members.value,
        avatar_id: Document::id(&data.chat.avatar),
        latest_message,
        latest_event_index: events_reader.latest_event_index().unwrap_or_default(),
        latest_message_index: events_reader.latest_message_index(),
        participant_count: data.chat.members.len(),
        is_public,
        frozen: data.frozen.value.clone(),
        events_ttl: events_ttl.value,
        events_ttl_last_updated: events_ttl.timestamp,
        gate: data.chat.gate_config.value.as_ref().map(|gc| gc.gate.clone()),
        gate_config: data.chat.gate_config.value.clone().map(|gc| gc.into()),
        wasm_version: BuildVersion::default(),
    };
    Success(SuccessResult {
        summary,
        is_invited: data.get_invitation(caller).is_some(),
    })
}
