use crate::read_state;
use crate::RuntimeState;
use candid::Principal;
use canister_api_macros::query;
use community_canister::summary::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn summary(args: Args) -> Response {
    read_state(|state| summary_impl(args.invite_code, args.on_behalf_of, state))
}

#[query(msgpack = true)]
fn c2c_summary(args: Args) -> Response {
    read_state(|state| summary_impl(args.invite_code, args.on_behalf_of, state))
}

fn summary_impl(invite_code: Option<u64>, on_behalf_of: Option<Principal>, state: &RuntimeState) -> Response {
    let caller = if let Some(principal) = on_behalf_of {
        assert!(state.is_caller_local_user_index());
        principal
    } else {
        state.env.caller()
    };

    if !state.data.is_accessible(caller, invite_code) {
        return PrivateCommunity;
    }

    let member = state.data.members.get(caller);
    let is_invited = state.data.is_invited(caller);

    let summary = state.summary(member.as_ref(), Some(is_invited));

    Success(summary)
}
