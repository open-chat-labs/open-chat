use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::register_proposal_vote_v2::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn register_proposal_vote_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_proposal_vote_impl(args, state)).into()
}

fn register_proposal_vote_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let min_visible_event_index = member.min_visible_event_index();
    let user_id = member.user_id();

    state
        .data
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt)?;

    let now = state.env.now();
    state
        .data
        .chat
        .members
        .register_proposal_vote(&user_id, args.message_index, now);

    handle_activity_notification(state);
    Ok(())
}
