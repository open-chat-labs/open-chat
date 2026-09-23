use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use community_canister::summary::{Response::*, *};
use ic_principal::Principal;
use types::{CommunityCanisterCommunitySummary, OCResult};

#[query(msgpack = true)]
fn summary(args: Args) -> Response {
    match read_state(|state| summary_impl(args.invite_code, args.on_behalf_of, state)) {
        Ok(summary) => Success(summary),
        Err(error) => Error(error),
    }
}

#[query(msgpack = true)]
fn c2c_summary(args: Args) -> Response {
    match read_state(|state| summary_impl(args.invite_code, args.on_behalf_of, state)) {
        Ok(summary) => Success(summary),
        Err(error) => Error(error),
    }
}

fn summary_impl(
    invite_code: Option<u64>,
    on_behalf_of: Option<Principal>,
    state: &RuntimeState,
) -> OCResult<CommunityCanisterCommunitySummary> {
    let caller = if let Some(principal) = on_behalf_of {
        assert!(state.is_caller_local_user_index());
        principal
    } else {
        state.env.caller()
    };

    state.data.verify_is_accessible(caller, invite_code)?;

    let member = state.data.members.get(caller);
    let is_invited = state.data.is_invited(caller);

    Ok(state.summary(member.as_ref(), Some(is_invited)))
}
