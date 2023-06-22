use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::RecordProposalVoteResult;
use community_canister::register_proposal_vote_v2::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn register_proposal_vote_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_proposal_vote_impl(args, state))
}

fn register_proposal_vote_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    let member = match state.data.members.get(caller) {
        Some(m) => m,
        None => return UserNotInCommunity,
    };

    if member.suspended.value {
        return UserSuspended;
    }

    let channel = match state.data.channels.get_mut(&args.channel_id) {
        Some(c) => c,
        None => return ChannelNotFound,
    };

    let channel_member = match channel.chat.members.get(&member.user_id) {
        Some(m) => m,
        None => return UserNotInChannel,
    };

    let now = state.env.now();
    let min_visible_event_index = channel_member.min_visible_event_index();
    let user_id = member.user_id;

    match channel
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt, now)
    {
        RecordProposalVoteResult::Success => {
            channel
                .chat
                .members
                .get_mut(&user_id)
                .unwrap()
                .proposal_votes
                .entry(now)
                .or_default()
                .push(args.message_index);

            handle_activity_notification(state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(_) => Success,
        RecordProposalVoteResult::ProposalNotFound => ProposalMessageNotFound,
    }
}
