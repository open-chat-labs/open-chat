use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use group_canister::summary::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn summary(_: Args) -> Response {
    read_state(summary_impl)
}

#[query_msgpack]
fn c2c_summary(_: Args) -> Response {
    read_state(summary_impl)
}

fn summary_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let now = runtime_state.env.now();
        let summary = runtime_state.summary(participant, now);
        Success(SuccessResult { summary })
    } else {
        CallerNotInGroup
    }
}
