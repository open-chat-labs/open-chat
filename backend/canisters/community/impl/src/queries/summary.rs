use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use community_canister::summary::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn summary(args: Args) -> Response {
    read_state(|state| summary_impl(args, state))
}

#[query_msgpack]
fn c2c_summary(args: Args) -> Response {
    read_state(|state| summary_impl(args, state))
}

fn summary_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
    }

    let member = state.data.members.get(caller);
    let now = state.env.now();

    let summary = state.summary(member, now);

    Success(summary)
}
