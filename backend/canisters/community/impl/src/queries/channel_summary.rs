use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::channel_summary::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{CommunityCanisterChannelSummary, OCResult};

#[query(candid = true, msgpack = true)]
fn channel_summary(args: Args) -> Response {
    match read_state(|state| summary_impl(args, state)) {
        Ok(summary) => Success(summary),
        Err(error) => Error(error),
    }
}

fn summary_impl(args: Args, state: &RuntimeState) -> OCResult<CommunityCanisterChannelSummary> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, args.invite_code)?;

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let user_id = state.data.members.lookup_user_id(caller);

    match channel.summary(user_id, state.data.is_public.value, &state.data.members) {
        Some(summary) => Ok(summary),
        None => Err(OCErrorCode::InitiatorNotInChat.into()),
    }
}
