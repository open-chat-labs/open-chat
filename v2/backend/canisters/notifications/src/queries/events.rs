use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::queries::events::Response::*;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::notifications::IndexedEvent;

const MAX_EVENTS_PER_BATCH: u32 = 100;

#[derive(CandidType, Deserialize)]
pub struct Args {
    from_event_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    events: Vec<IndexedEvent>,
}

#[query]
fn events(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_push_service() {
        let events = runtime_state.data.events.get(args.from_event_index, MAX_EVENTS_PER_BATCH);
        Success(SuccessResult { events })
    } else {
        NotAuthorized
    }
}
