use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::RecordProposalVoteResult;
use group_canister::register_proposal_vote_v2::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn register_proposal_vote_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_proposal_vote_impl(args, state))
}

fn register_proposal_vote_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();

    let member = match state.data.get_member(caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    if member.suspended().value {
        return UserSuspended;
    } else if member.lapsed().value {
        return UserLapsed;
    }

    let min_visible_event_index = member.min_visible_event_index();
    let user_id = member.user_id();

    match state
        .data
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt)
    {
        RecordProposalVoteResult::Success => {
            let now = state.env.now();
            state
                .data
                .chat
                .members
                .register_proposal_vote(&user_id, args.message_index, now);

            handle_activity_notification(state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(_) => Success,
        RecordProposalVoteResult::ProposalNotFound => ProposalMessageNotFound,
    }
}
