use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::register_proposal_vote_v2::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn register_proposal_vote_v2(args: Args) -> Response {
    execute_update(|state| register_proposal_vote_impl(args, state)).into()
}

fn register_proposal_vote_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let member = state.get_calling_member(None, true)?;
    let min_visible_event_index = member.min_visible_event_index();
    let user_id = member.user_id();
    let now = state.env.now();

    state
        .data
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt, now)?;

    state
        .data
        .chat
        .members
        .register_proposal_vote(&user_id, args.message_index, now);

    state.mark_activity_for_user(user_id);
    Ok(())
}
