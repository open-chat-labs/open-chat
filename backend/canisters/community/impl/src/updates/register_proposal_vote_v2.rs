use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::register_proposal_vote_v2::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn register_proposal_vote_v2(args: Args) -> Response {
    execute_update(|state| register_proposal_vote_impl(args, state)).into()
}

fn register_proposal_vote_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(None, true)?;
    let user_id = member.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let channel_member = channel.chat.members.get_verified_member(user_id)?;
    let min_visible_event_index = channel_member.min_visible_event_index();
    let now = state.env.now();

    channel
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt, now)?;

    channel.chat.members.register_proposal_vote(&user_id, args.message_index, now);

    state.mark_activity_for_user(user_id);
    Ok(())
}
