use crate::read_state;
use crate::{RuntimeState, WASM_VERSION};
use canister_api_macros::query_candid_and_msgpack;
use group_canister::public_summary::{Response::*, *};
use types::{Avatar, PublicGroupSummary};

#[query_candid_and_msgpack]
fn public_summary(args: Args) -> Response {
    read_state(|runtime_state: &RuntimeState| public_summary_impl(args, runtime_state))
}

fn public_summary_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if !runtime_state.data.is_accessible_by_non_member(args.invite_code) {
        return NotAuthorized;
    }

    let data = &runtime_state.data;
    let chat_events = runtime_state.data.events.main();
    let latest_event = chat_events.last();

    let summary = PublicGroupSummary {
        chat_id: runtime_state.env.canister_id().into(),
        last_updated: latest_event.timestamp,
        name: data.name.clone(),
        description: data.description.clone(),
        avatar_id: Avatar::id(&data.avatar),
        latest_message: chat_events.latest_message(None),
        latest_event_index: latest_event.index,
        participant_count: data.participants.len(),
        wasm_version: WASM_VERSION.with(|v| **v.borrow()),
        owner_id: runtime_state.data.owner_id,
        is_public: runtime_state.data.is_public,
    };
    Success(SuccessResult { summary })
}
