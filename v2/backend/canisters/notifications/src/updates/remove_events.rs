use super::remove_events::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
struct Args {
    up_to_event_index: u64,
}

#[derive(CandidType)]
enum Response {
    Success,
    NotAuthorized,
}

#[update]
fn remove_events(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_events_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_consumer() {
        runtime_state.data.events.remove(args.up_to_event_index);
        Success
    } else {
        NotAuthorized
    }
}
