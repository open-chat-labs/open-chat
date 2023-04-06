use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::RecordProposalVoteResult;
use group_canister::register_proposal_vote_v2::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn register_proposal_vote_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_proposal_vote_impl(args, state))
}

fn register_proposal_vote_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();

    let participant = match runtime_state.data.participants.get_by_principal_mut(&caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    if participant.suspended.value {
        return UserSuspended;
    }

    let now = runtime_state.env.now();
    let min_visible_event_index = participant.min_visible_event_index();

    match runtime_state.data.events.record_proposal_vote(
        participant.user_id,
        min_visible_event_index,
        args.message_index,
        args.adopt,
        now,
    ) {
        RecordProposalVoteResult::Success => {
            participant.proposal_votes.entry(now).or_default().push(args.message_index);
            handle_activity_notification(runtime_state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(_) => Success,
        RecordProposalVoteResult::ProposalNotFound => ProposalMessageNotFound,
    }
}
