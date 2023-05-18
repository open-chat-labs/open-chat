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

    let member = match runtime_state.data.get_member_mut(caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    if member.suspended.value {
        return UserSuspended;
    }

    let now = runtime_state.env.now();
    let min_visible_event_index = member.min_visible_event_index();
    let user_id = member.user_id;

    match runtime_state.data.group_chat_core.events.record_proposal_vote(
        user_id,
        min_visible_event_index,
        args.message_index,
        args.adopt,
        now,
    ) {
        RecordProposalVoteResult::Success => {
            runtime_state
                .data
                .group_chat_core
                .members
                .get_mut(&user_id)
                .unwrap()
                .proposal_votes
                .entry(now)
                .or_default()
                .push(args.message_index);

            handle_activity_notification(runtime_state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(_) => Success,
        RecordProposalVoteResult::ProposalNotFound => ProposalMessageNotFound,
    }
}
