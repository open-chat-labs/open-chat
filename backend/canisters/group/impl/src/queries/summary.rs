use crate::read_state;
use crate::RuntimeState;
use candid::Principal;
use canister_api_macros::query;
use group_canister::summary::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn summary(args: Args) -> Response {
    read_state(|state| summary_impl(args.on_behalf_of, state))
}

#[query(msgpack = true)]
fn c2c_summary(args: Args) -> Response {
    read_state(|state| summary_impl(args.on_behalf_of, state))
}

fn summary_impl(on_behalf_of: Option<Principal>, state: &RuntimeState) -> Response {
    let caller = if let Some(principal) = on_behalf_of {
        assert!(state.is_caller_local_user_index());
        principal
    } else {
        state.env.caller()
    };

    if let Some(member) = state.data.get_member(caller) {
        let summary = state.summary(member);
        Success(SuccessResult { summary })
    } else {
        CallerNotInGroup
    }
}
