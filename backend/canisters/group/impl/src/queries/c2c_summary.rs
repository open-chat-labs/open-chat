use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use group_canister::c2c_summary::{Response::*, *};

#[query_candid_and_msgpack]
fn c2c_summary(_: Args) -> Response {
    read_state(c2c_summary_impl)
}

fn c2c_summary_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let summary = runtime_state.summary(participant);
        Success(SuccessResult { summary })
    } else {
        CallerNotInGroup
    }
}
