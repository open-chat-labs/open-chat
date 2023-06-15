use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use community_canister::summary::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn summary(_: Args) -> Response {
    read_state(summary_impl)
}

#[query_msgpack]
fn c2c_summary(_: Args) -> Response {
    read_state(summary_impl)
}

fn summary_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let member = state.data.members.get(caller);

    if member.is_none() && !state.data.is_public {
        return UserNotInCommunity;
    }

    let now = state.env.now();
    let summary = state.summary(member, now);
    Success(summary)
}
