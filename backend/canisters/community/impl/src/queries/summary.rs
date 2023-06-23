use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use community_canister::summary::{Response::*, *};
use ic_cdk_macros::query;
use types::CommunityMatch;

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
    let member = state.data.members.get(caller);

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
    }

    if member.is_none() && !state.data.is_public {
        return Invited(CommunityMatch {
            id: state.env.canister_id().into(),
            name: state.data.name.clone(),
            description: state.data.description.clone(),
            avatar_id: state.data.avatar.as_ref().map(|a| a.id),
            banner_id: state.data.banner.as_ref().map(|b| b.id),
            member_count: state.data.members.len(),
            channel_count: state.data.channels.public_channel_count(),
            gate: state.data.gate.as_ref().cloned(),
        });
    }

    let now = state.env.now();
    let summary = state.summary(member, now);
    Success(summary)
}
