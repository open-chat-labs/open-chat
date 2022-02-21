use crate::guards::group_is_public;
use crate::read_state;
use crate::{RuntimeState, WASM_VERSION};
use group_canister::public_summary::{Response::*, *};
use ic_cdk_macros::query;
use types::{Avatar, PublicGroupSummary};

#[query(guard = "group_is_public")]
fn public_summary(_: Args) -> Response {
    read_state(public_summary_impl)
}

fn public_summary_impl(runtime_state: &RuntimeState) -> Response {
    let data = &runtime_state.data;
    let latest_event = runtime_state.data.events.last();

    let summary = PublicGroupSummary {
        chat_id: runtime_state.env.canister_id().into(),
        last_updated: latest_event.timestamp,
        name: data.name.clone(),
        description: data.description.clone(),
        avatar_id: Avatar::id(&data.avatar),
        latest_message: data.events.latest_message(),
        latest_event_index: latest_event.index,
        participant_count: data.participants.len(),
        pinned_message: None,
        wasm_version: WASM_VERSION.with(|v| **v.borrow()),
        owner_id: runtime_state.data.owner_id,
    };
    Success(SuccessResult { summary })
}
